"""Unit tests for the acquisition.simulatedPoll RPC handler.

No real SQLite is used — TELEMETRY_DB_PATH is either absent or patched to a
temp file only when we need to reach the storage layer. The validation tests
exercise the handler in isolation via RpcServer.dispatch().
"""

from __future__ import annotations

import asyncio

from rpc.server import INVALID_PARAMS, RpcServer

# ── Helpers ────────────────────────────────────────────────────────────────────

_VALID_REGISTER_MAP = {
    "version": 1,
    "registers": [
        {"address": 100, "function": "holding", "metric": "voltage_l1", "datatype": "float32"},
        {"address": 102, "function": "holding", "metric": "current_l1", "datatype": "float32"},
    ],
}

_VALID_PARAMS = {
    "deviceId": 1,
    "registerMap": _VALID_REGISTER_MAP,
    "ticks": 3,
}


def _dispatch(params: dict) -> dict:
    server = RpcServer()
    return asyncio.run(
        server.dispatch(
            {"jsonrpc": "2.0", "id": 1, "method": "acquisition.simulatedPoll", "params": params}
        )
    )


# ── Validation tests (no DB required) ─────────────────────────────────────────


def test_rpc_simulated_poll_validates_device_id_missing():
    """Missing deviceId must return INVALID_PARAMS."""
    response = _dispatch({"registerMap": _VALID_REGISTER_MAP})
    assert "error" in response
    assert response["error"]["code"] == INVALID_PARAMS


def test_rpc_simulated_poll_validates_device_id_negative():
    """Negative deviceId must return INVALID_PARAMS."""
    response = _dispatch({"deviceId": -5, "registerMap": _VALID_REGISTER_MAP})
    assert "error" in response
    assert response["error"]["code"] == INVALID_PARAMS


def test_rpc_simulated_poll_validates_device_id_zero():
    """deviceId=0 is not positive — must return INVALID_PARAMS."""
    response = _dispatch({"deviceId": 0, "registerMap": _VALID_REGISTER_MAP})
    assert "error" in response
    assert response["error"]["code"] == INVALID_PARAMS


def test_rpc_simulated_poll_validates_register_map_missing():
    """Missing registerMap must return INVALID_PARAMS."""
    response = _dispatch({"deviceId": 1})
    assert "error" in response
    assert response["error"]["code"] == INVALID_PARAMS


def test_rpc_simulated_poll_validates_register_map_empty_registers():
    """A registerMap with no registers must return INVALID_PARAMS."""
    bad_map = {"version": 1, "registers": []}
    response = _dispatch({"deviceId": 1, "registerMap": bad_map})
    assert "error" in response
    assert response["error"]["code"] == INVALID_PARAMS


def test_rpc_simulated_poll_validates_register_map_version_zero():
    """version=0 violates the RegisterMap contract — must return INVALID_PARAMS."""
    bad_map = {
        "version": 0,
        "registers": [
            {"address": 100, "function": "holding", "metric": "voltage_l1", "datatype": "float32"}
        ],
    }
    response = _dispatch({"deviceId": 1, "registerMap": bad_map})
    assert "error" in response
    assert response["error"]["code"] == INVALID_PARAMS


def test_rpc_simulated_poll_validates_ticks_out_of_range():
    """ticks=0 is below the minimum — must return INVALID_PARAMS."""
    response = _dispatch({**_VALID_PARAMS, "ticks": 0})
    assert "error" in response
    assert response["error"]["code"] == INVALID_PARAMS


def test_rpc_simulated_poll_validates_ticks_too_large():
    """ticks=1001 exceeds the maximum — must return INVALID_PARAMS."""
    response = _dispatch({**_VALID_PARAMS, "ticks": 1001})
    assert "error" in response
    assert response["error"]["code"] == INVALID_PARAMS


def test_rpc_simulated_poll_missing_telemetry_path(monkeypatch):
    """When TELEMETRY_DB_PATH is not set the handler must return an error."""
    monkeypatch.delenv("TELEMETRY_DB_PATH", raising=False)
    response = _dispatch(_VALID_PARAMS)
    assert "error" in response
    # The env-var check raises ValueError → INVALID_PARAMS
    assert response["error"]["code"] == INVALID_PARAMS


# ── Integration smoke test (real temp DB) ─────────────────────────────────────


def test_rpc_simulated_poll_returns_summary(tmp_path, monkeypatch):
    """Happy path: valid params + real temp DB → summary dict with correct keys."""
    db_path = str(tmp_path / "telemetry.db")
    monkeypatch.setenv("TELEMETRY_DB_PATH", db_path)

    response = _dispatch(_VALID_PARAMS)

    assert "result" in response, f"expected result, got: {response}"
    result = response["result"]
    assert result["ticks"] == 3
    assert result["metrics"] == 2
    assert result["inserted"] == 6   # 3 ticks × 2 metrics, all new
    assert result["ignored"] == 0
