"""Tests for acquisition.scheduler: pure domain function + LiveWatchService."""

from __future__ import annotations

import asyncio
import contextlib

from acquisition.profiles.register_map import RegisterMap
from acquisition.scheduler.domain import next_tick
from acquisition.scheduler.service import LiveWatchService
from storage.domain import Reading

_REGISTER_MAP = RegisterMap.model_validate(
    {
        "version": 1,
        "registers": [
            {"address": 100, "function": "holding", "metric": "voltage_l1", "datatype": "float32"},
            {"address": 102, "function": "holding", "metric": "current_l1", "datatype": "float32"},
        ],
    }
)


# ── domain.py — pure ──────────────────────────────────────────────────────────


def test_next_tick_increments():
    assert next_tick(0) == 1
    assert next_tick(1) == 2
    assert next_tick(41) == 42


# ── service.py — LiveWatchService with a fake ModbusReader ───────────────────


class FakeReader:
    """Deterministic double: records every call and returns a fixed batch."""

    def __init__(self) -> None:
        self.calls: list[tuple[int, int]] = []

    def read(self, device_id: int, register_map: RegisterMap, tick: int) -> list[Reading]:
        self.calls.append((device_id, tick))
        return [
            Reading(device_id=device_id, metric=entry.metric, timestamp=tick, value=float(tick), source="simulated")
            for entry in register_map.registers
        ]


def test_live_watch_service_calls_reader_and_on_reading_each_tick():
    reader = FakeReader()
    service = LiveWatchService(reader)
    batches: list[list[Reading]] = []

    async def scenario():
        task = asyncio.get_running_loop().create_task(
            service.run(1, _REGISTER_MAP, batches.append, interval_s=0)
        )
        # Let several ticks happen without waiting the real production interval.
        await asyncio.sleep(0.02)
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

    asyncio.run(scenario())

    assert len(reader.calls) > 0
    assert len(batches) == len(reader.calls)
    # tick counter is monotonic and starts at 1 (next_tick(0) == 1)
    ticks = [call[1] for call in reader.calls]
    assert ticks == sorted(ticks)
    assert ticks[0] == 1
    # every batch has one Reading per register entry
    assert all(len(batch) == len(_REGISTER_MAP.registers) for batch in batches)
    assert all(reading.device_id == 1 for batch in batches for reading in batch)


def test_live_watch_service_stops_when_task_is_cancelled():
    reader = FakeReader()
    service = LiveWatchService(reader)

    async def scenario():
        task = asyncio.get_running_loop().create_task(
            service.run(1, _REGISTER_MAP, lambda _batch: None, interval_s=0)
        )
        await asyncio.sleep(0.01)
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        assert task.done()

    asyncio.run(scenario())
