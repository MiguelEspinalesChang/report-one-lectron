"""Tests for the pydantic RegisterMap model.

Validates the Python-side mirror of the zod register map contract
(docs/features/db-architecture.md §3.4).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from acquisition.profiles.register_map import RegisterMap

# ── Fixtures ──────────────────────────────────────────────────────────────────

# Realistic 8-metric map for the SIM-100 simulated meter (§5).
VALID_MAP_8_METRICS = {
    "version": 1,
    "registers": [
        {"address": 3000, "function": "holding", "metric": "voltage_l1",  "datatype": "float32", "wordOrder": "big_endian", "scale": 1.0, "unit": "V"},
        {"address": 3002, "function": "holding", "metric": "voltage_l2",  "datatype": "float32", "wordOrder": "big_endian", "scale": 1.0, "unit": "V"},
        {"address": 3004, "function": "holding", "metric": "voltage_l3",  "datatype": "float32", "wordOrder": "big_endian", "scale": 1.0, "unit": "V"},
        {"address": 3006, "function": "holding", "metric": "current_l1",  "datatype": "float32", "wordOrder": "big_endian", "scale": 1.0, "unit": "A"},
        {"address": 3008, "function": "holding", "metric": "current_l2",  "datatype": "float32", "wordOrder": "big_endian", "scale": 1.0, "unit": "A"},
        {"address": 3010, "function": "holding", "metric": "current_l3",  "datatype": "float32", "wordOrder": "big_endian", "scale": 1.0, "unit": "A"},
        {"address": 3012, "function": "holding", "metric": "active_power","datatype": "float32", "wordOrder": "big_endian", "scale": 1.0, "unit": "W"},
        {"address": 3059, "function": "holding", "metric": "energy_total", "datatype": "float32", "wordOrder": "big_endian", "scale": 1.0, "unit": "kWh"},
    ],
}


# ── Happy-path tests ───────────────────────────────────────────────────────────


def test_valid_8_metric_map_parses_correctly():
    rm = RegisterMap.model_validate(VALID_MAP_8_METRICS)
    assert rm.version == 1
    assert len(rm.registers) == 8


def test_register_metrics_accessible():
    rm = RegisterMap.model_validate(VALID_MAP_8_METRICS)
    metrics = [r.metric for r in rm.registers]
    assert "voltage_l1" in metrics
    assert "energy_total" in metrics


def test_wordorder_camelcase_wire_format_accepted():
    """The RPC wire format uses camelCase; pydantic must accept it."""
    rm = RegisterMap.model_validate(VALID_MAP_8_METRICS)
    assert rm.registers[0].word_order == "big_endian"


def test_snake_case_word_order_also_accepted():
    data = {
        "version": 1,
        "registers": [
            {
                "address": 100,
                "function": "holding",
                "metric": "voltage_l1",
                "datatype": "float32",
                "word_order": "little_endian",
                "scale": 0.1,
                "unit": "V",
            }
        ],
    }
    rm = RegisterMap.model_validate(data)
    assert rm.registers[0].word_order == "little_endian"


def test_minimal_register_defaults_applied():
    """scale and unit have defaults; word_order defaults to big_endian."""
    data = {
        "version": 1,
        "registers": [
            {"address": 100, "function": "input", "metric": "temp", "datatype": "int16"}
        ],
    }
    rm = RegisterMap.model_validate(data)
    reg = rm.registers[0]
    assert reg.scale == 1.0
    assert reg.unit == ""
    assert reg.word_order == "big_endian"


# ── Rejection tests ───────────────────────────────────────────────────────────


def test_duplicate_metrics_rejected():
    data = {
        "version": 1,
        "registers": [
            {"address": 100, "function": "holding", "metric": "voltage_l1", "datatype": "float32"},
            {"address": 102, "function": "holding", "metric": "voltage_l1", "datatype": "float32"},
        ],
    }
    with pytest.raises(ValidationError) as exc_info:
        RegisterMap.model_validate(data)
    assert "duplicate metric" in str(exc_info.value).lower()


def test_empty_registers_rejected():
    data = {"version": 1, "registers": []}
    with pytest.raises(ValidationError) as exc_info:
        RegisterMap.model_validate(data)
    assert "registers" in str(exc_info.value).lower()


def test_version_zero_rejected():
    data = {
        "version": 0,
        "registers": [
            {"address": 100, "function": "holding", "metric": "voltage_l1", "datatype": "float32"}
        ],
    }
    with pytest.raises(ValidationError) as exc_info:
        RegisterMap.model_validate(data)
    assert "version" in str(exc_info.value).lower()


def test_version_two_rejected():
    """The zod contract pins version to literal 1; the mirror must too."""
    data = {
        "version": 2,
        "registers": [
            {"address": 100, "function": "holding", "metric": "voltage_l1", "datatype": "float32"}
        ],
    }
    with pytest.raises(ValidationError) as exc_info:
        RegisterMap.model_validate(data)
    assert "version" in str(exc_info.value).lower()


def test_invalid_datatype_rejected():
    data = {
        "version": 1,
        "registers": [
            {"address": 100, "function": "holding", "metric": "voltage_l1", "datatype": "boolean"}
        ],
    }
    with pytest.raises(ValidationError):
        RegisterMap.model_validate(data)


def test_invalid_function_code_rejected():
    data = {
        "version": 1,
        "registers": [
            {"address": 100, "function": "coil", "metric": "voltage_l1", "datatype": "float32"}
        ],
    }
    with pytest.raises(ValidationError):
        RegisterMap.model_validate(data)


def test_missing_version_rejected():
    data = {
        "registers": [
            {"address": 100, "function": "holding", "metric": "voltage_l1", "datatype": "float32"}
        ]
    }
    with pytest.raises(ValidationError):
        RegisterMap.model_validate(data)


def test_address_above_range_rejected():
    """Modbus addresses are 16-bit: > 65535 must be rejected (mirrors zod .max(65535))."""
    data = {
        "version": 1,
        "registers": [
            {"address": 65536, "function": "holding", "metric": "voltage_l1", "datatype": "float32"}
        ],
    }
    with pytest.raises(ValidationError) as exc_info:
        RegisterMap.model_validate(data)
    assert "address" in str(exc_info.value).lower()


def test_negative_address_rejected():
    """Negative addresses must be rejected (mirrors zod .min(0))."""
    data = {
        "version": 1,
        "registers": [
            {"address": -1, "function": "holding", "metric": "voltage_l1", "datatype": "float32"}
        ],
    }
    with pytest.raises(ValidationError) as exc_info:
        RegisterMap.model_validate(data)
    assert "address" in str(exc_info.value).lower()
