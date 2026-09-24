from __future__ import annotations

import asyncio
import contextlib

from rpc.server import INVALID_PARAMS, METHOD_NOT_FOUND, RpcServer

_VALID_REGISTER_MAP = {
    "version": 1,
    "registers": [
        {"address": 100, "function": "holding", "metric": "voltage_l1", "datatype": "float32"},
        {"address": 102, "function": "holding", "metric": "current_l1", "datatype": "float32"},
    ],
}


def test_ping_returns_ok():
    server = RpcServer()
    response = asyncio.run(
        server.dispatch({"jsonrpc": "2.0", "id": 1, "method": "system.ping"})
    )
    assert response["result"]["status"] == "ok"
    assert response["result"]["pid"] > 0


def test_unknown_method_returns_error():
    server = RpcServer()
    response = asyncio.run(
        server.dispatch({"jsonrpc": "2.0", "id": 2, "method": "does.not.exist"})
    )
    assert response["error"]["code"] == METHOD_NOT_FOUND


def test_watch_rejects_invalid_device_id():
    server = RpcServer()
    response = asyncio.run(
        server.dispatch(
            {"jsonrpc": "2.0", "id": 3, "method": "device.watch", "params": {"deviceId": -1}}
        )
    )
    assert response["error"]["code"] == INVALID_PARAMS


def test_watch_rejects_missing_register_map():
    server = RpcServer()
    response = asyncio.run(
        server.dispatch(
            {"jsonrpc": "2.0", "id": 4, "method": "device.watch", "params": {"deviceId": 1}}
        )
    )
    assert response["error"]["code"] == INVALID_PARAMS


def test_watch_emits_real_register_map_readings_until_unwatch():
    """device.watch must emit device.reading events driven by SimulatedReader
    over the REAL register map passed in params — no more hardcoded 'voltage'.

    Runs with the real LIVE_INTERVAL_SECONDS (2s) — never patched. This works
    without waiting 2s because LiveWatchService.run() emits the first tick
    immediately, before its first `await asyncio.sleep(interval_s)`; the
    0.02s sleep below only needs to yield control long enough for that first
    tick to land before we unwatch.
    """
    server = RpcServer()
    notifications: list[tuple[str, dict]] = []
    server.notify = lambda method, params: notifications.append((method, params))

    async def scenario():
        watch_response = await server.dispatch(
            {
                "jsonrpc": "2.0",
                "id": 5,
                "method": "device.watch",
                "params": {"deviceId": 7, "registerMap": _VALID_REGISTER_MAP},
            }
        )
        task = server._watch_tasks[7]
        await asyncio.sleep(0.02)  # let a few ticks run — never the real 2s interval
        await server.dispatch(
            {"jsonrpc": "2.0", "id": 6, "method": "device.unwatch", "params": {"deviceId": 7}}
        )
        with contextlib.suppress(asyncio.CancelledError):
            await task
        return watch_response

    watch_response = asyncio.run(scenario())

    assert watch_response["result"] == {"watching": 7}

    status_events = [p for m, p in notifications if m == "device.status"]
    assert {"deviceId": 7, "state": "connected"} in status_events
    assert {"deviceId": 7, "state": "disconnected"} in status_events

    reading_events = [p for m, p in notifications if m == "device.reading"]
    assert len(reading_events) > 0
    metrics_seen = {event["metric"] for event in reading_events}
    assert metrics_seen == {"voltage_l1", "current_l1"}
    for event in reading_events:
        assert event["deviceId"] == 7
        assert isinstance(event["value"], float)
        assert isinstance(event["timestamp"], int)
