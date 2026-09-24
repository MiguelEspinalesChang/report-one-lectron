"""Live watch service — the per-device live-polling loop (docs/ARCHITECTURE.md §7).

Live mode NEVER writes to telemetry.db: readings are pushed to the caller via
`on_reading` for ephemeral, real-time display only. The base poll (15 min,
persisted through storage.adapters.sqlite_writer) is the official history and
lives in a different code path (rpc.server._simulated_poll for now).

This service knows nothing about JSON-RPC or asyncio tasks management beyond
its own loop — the RPC layer (a thin entry adapter) owns task lifecycle
(creation on device.watch, cancellation on device.unwatch) and translates
each Reading batch into `device.reading` notifications.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import TYPE_CHECKING

from acquisition.scheduler.domain import next_tick

if TYPE_CHECKING:
    from acquisition.ports import ModbusReader
    from acquisition.profiles.register_map import RegisterMap
    from storage.domain import Reading


class LiveWatchService:
    """Runs an indefinite live-polling loop for a single device.

    Receives its `ModbusReader` port by constructor (hexagonal rule: services
    take ports, never construct adapters themselves).
    """

    def __init__(self, reader: ModbusReader) -> None:
        self._reader = reader

    async def run(
        self,
        device_id: int,
        register_map: RegisterMap,
        on_reading: Callable[[list[Reading]], None],
        interval_s: float,
    ) -> None:
        """Poll forever until the caller cancels the enclosing asyncio.Task.

        Args:
            device_id: logical device identifier.
            register_map: validated profile describing which registers to read.
            on_reading: invoked once per tick with the full batch of Readings
                produced by that tick (empty list is possible on read failure).
            interval_s: seconds to sleep between ticks.
        """
        tick = 0
        while True:
            tick = next_tick(tick)
            batch = self._reader.read(device_id, register_map, tick)
            on_reading(batch)
            await asyncio.sleep(interval_s)
