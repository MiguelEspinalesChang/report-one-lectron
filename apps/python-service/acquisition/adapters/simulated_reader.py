"""Simulated Modbus reader — deterministic, no I/O, no random module.

Produces plausible electrical readings for each metric defined in a
RegisterMap. Values are driven entirely by the tick counter and a
deterministic hash-based phase offset per metric name, so the same
(device_id, register_map, tick) triple always yields the same output.

This adapter satisfies the spirit of the ModbusReader Protocol:
  read(device_id, register_map, tick)  → list[Reading]

It accepts an extra positional argument ``base_timestamp_ms`` because the
caller needs to control the timestamp of each tick without relying on
wall-clock time during a batch loop. When the caller omits it (or passes
None), the current wall-clock time is used.
"""

from __future__ import annotations

import hashlib
import math
import time
from typing import Final

from acquisition.profiles.register_map import RegisterMap
from storage.domain import Reading

# ── Per-metric-class wave parameters ─────────────────────────────────────────

# (base, amplitude, frequency) — used for instantaneous metrics.
_VOLTAGE_PARAMS: Final = (220.0, 5.0, 0.1)
_CURRENT_PARAMS: Final = (10.0, 2.0, 0.13)
_POWER_PARAMS: Final = (2200.0, 400.0, 0.07)
_DEFAULT_PARAMS: Final = (100.0, 10.0, 0.05)

# Energy accumulation rate: kWh per tick.
_ENERGY_RATE: Final = 0.25


def _metric_offset(metric: str) -> int:
    """Deterministic per-metric phase offset derived from its name."""
    return int(hashlib.md5(metric.encode(), usedforsecurity=False).hexdigest()[:4], 16)


def _instantaneous_value(metric: str, tick: int, base: float, amplitude: float, frequency: float) -> float:
    """Sinusoidal wave + bounded deterministic noise — no random module."""
    offset = _metric_offset(metric)
    phase_shift = offset * 0.001
    signal = base + amplitude * math.sin(tick * frequency + phase_shift)
    noise = ((tick * 1_234_567 + offset) % 100 - 50) / 1000.0 * base * 0.01
    return signal + noise


def _wave_params(metric: str) -> tuple[float, float, float]:
    """Return (base, amplitude, frequency) for the metric's class."""
    if metric.startswith("voltage_"):
        return _VOLTAGE_PARAMS
    if metric.startswith("current_"):
        return _CURRENT_PARAMS
    if metric.startswith("power_"):
        return _POWER_PARAMS
    return _DEFAULT_PARAMS


def _is_energy_metric(metric: str) -> bool:
    return metric.startswith(("energy_", "kwh_"))


class SimulatedReader:
    """Produces deterministic simulated readings for a RegisterMap.

    Usage::

        reader = SimulatedReader()
        readings = reader.read(device_id=1, register_map=rmap, tick=1,
                               base_timestamp_ms=int(time.time() * 1000))
    """

    def read(
        self,
        device_id: int,
        register_map: RegisterMap,
        tick: int,
        base_timestamp_ms: int | None = None,
    ) -> list[Reading]:
        """Generate one Reading per register entry.

        Args:
            device_id: logical device ID.
            register_map: validated RegisterMap; only metrics declared here
                are produced.
            tick: monotonic counter. Callers increment it once per poll cycle.
            base_timestamp_ms: epoch ms for every reading in this batch.
                Defaults to the current wall-clock time when None.

        Returns:
            One Reading per entry in register_map.registers.
        """
        ts = base_timestamp_ms if base_timestamp_ms is not None else int(time.time() * 1000)
        readings: list[Reading] = []

        for entry in register_map.registers:
            metric = entry.metric
            scale = entry.scale

            if _is_energy_metric(metric):
                # Monotonically increasing: accumulates at _ENERGY_RATE per tick.
                raw = tick * _ENERGY_RATE
                value = raw * scale
            else:
                base, amplitude, frequency = _wave_params(metric)
                value = _instantaneous_value(metric, tick, base, amplitude, frequency) * scale

            readings.append(
                Reading(
                    device_id=device_id,
                    metric=metric,
                    timestamp=ts,
                    value=value,
                    source="simulated",
                )
            )

        return readings
