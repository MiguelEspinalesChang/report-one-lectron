"""Tests for SimulatedReader — deterministic acquisition adapter.

All tests are pure unit tests: no I/O, no DB, no network.
The RegisterMap is constructed inline using the pydantic model.
"""

from __future__ import annotations

import pytest

from acquisition.adapters.simulated_reader import SimulatedReader
from acquisition.profiles.register_map import RegisterMap

# ── Fixtures ───────────────────────────────────────────────────────────────────

_SMALL_MAP_PAYLOAD = {
    "version": 1,
    "registers": [
        {"address": 100, "function": "holding", "metric": "voltage_l1", "datatype": "float32"},
        {"address": 102, "function": "holding", "metric": "current_l1", "datatype": "float32"},
        {"address": 104, "function": "holding", "metric": "energy_active", "datatype": "float32"},
        {"address": 106, "function": "holding", "metric": "power_active", "datatype": "float32"},
    ],
}


@pytest.fixture()
def small_map() -> RegisterMap:
    return RegisterMap.model_validate(_SMALL_MAP_PAYLOAD)


@pytest.fixture()
def reader() -> SimulatedReader:
    return SimulatedReader()


# ── Tests ──────────────────────────────────────────────────────────────────────


def test_simulated_reader_produces_readings_for_each_metric(reader, small_map):
    """One Reading is produced per RegisterEntry in the map."""
    readings = reader.read(device_id=1, register_map=small_map, tick=1, base_timestamp_ms=1_000_000)
    assert len(readings) == len(small_map.registers)
    metric_names = {r.metric for r in readings}
    expected = {"voltage_l1", "current_l1", "energy_active", "power_active"}
    assert metric_names == expected


def test_simulated_reader_respects_register_map_entries(reader, small_map):
    """Readings reference device_id and the exact metric names from the map."""
    device_id = 42
    readings = reader.read(device_id=device_id, register_map=small_map, tick=1, base_timestamp_ms=1_000_000)
    for reading in readings:
        assert reading.device_id == device_id
        assert reading.metric in {e.metric for e in small_map.registers}


def test_simulated_reader_energy_metrics_are_monotonic(reader, small_map):
    """Energy metric value at tick N+1 must be greater than at tick N."""
    ts = 1_000_000
    readings_t1 = reader.read(device_id=1, register_map=small_map, tick=1, base_timestamp_ms=ts)
    readings_t2 = reader.read(device_id=1, register_map=small_map, tick=2, base_timestamp_ms=ts + 1000)

    energy_t1 = next(r.value for r in readings_t1 if r.metric == "energy_active")
    energy_t2 = next(r.value for r in readings_t2 if r.metric == "energy_active")

    assert energy_t2 > energy_t1, (
        f"energy_active must increase monotonically: tick1={energy_t1}, tick2={energy_t2}"
    )


def test_simulated_reader_instantaneous_metrics_are_bounded(reader, small_map):
    """voltage_l1 must stay within 200–240 V across 100 ticks (base=220, amplitude=5)."""
    ts_base = 1_000_000
    for tick in range(1, 101):
        readings = reader.read(
            device_id=1,
            register_map=small_map,
            tick=tick,
            base_timestamp_ms=ts_base + (tick - 1) * 1000,
        )
        voltage = next(r.value for r in readings if r.metric == "voltage_l1")
        assert 200.0 <= voltage <= 240.0, (
            f"voltage_l1 out of bounds at tick={tick}: {voltage}"
        )


def test_simulated_reader_is_deterministic(reader, small_map):
    """Same (device_id, register_map, tick, base_timestamp_ms) always yields identical values."""
    ts = 1_700_000_000_000
    first = reader.read(device_id=1, register_map=small_map, tick=5, base_timestamp_ms=ts)
    second = reader.read(device_id=1, register_map=small_map, tick=5, base_timestamp_ms=ts)

    assert len(first) == len(second)
    for r1, r2 in zip(first, second, strict=True):
        assert r1.metric == r2.metric
        assert r1.value == r2.value
        assert r1.timestamp == r2.timestamp
        assert r1.device_id == r2.device_id


def test_simulated_reader_source_is_simulated(reader, small_map):
    """All produced readings must carry source='simulated'."""
    readings = reader.read(device_id=1, register_map=small_map, tick=1, base_timestamp_ms=1_000_000)
    assert readings, "expected at least one reading"
    for reading in readings:
        assert reading.source == "simulated", (
            f"metric {reading.metric!r} has source {reading.source!r}, expected 'simulated'"
        )
