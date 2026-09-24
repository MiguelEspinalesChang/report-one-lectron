"""JSON-RPC 2.0 server over stdio, newline-delimited.

The Electron core (packages/core) is the client: it writes requests to our
stdin and reads responses from our stdout. Besides responses, the server
emits unsolicited notifications (device readings, status changes) so the UI
can react in real time without polling.

Method names must stay in sync with `RpcMethods` in packages/shared-types.
"""

from __future__ import annotations

import asyncio
import json
import os
import platform
import sys
import time

from acquisition.adapters.simulated_reader import SimulatedReader
from acquisition.profiles.register_map import RegisterMap
from acquisition.scheduler.service import LiveWatchService
from storage.adapters.sqlite_writer import SqliteTelemetryWriter
from storage.domain import Reading
from storage.migrations import apply_migrations

PARSE_ERROR = -32700
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603

# Live-watch cadence (SimulatedReader today; real Modbus reader later swaps in
# behind the same ModbusReader port without touching this constant).
LIVE_INTERVAL_SECONDS = 2.0


class RpcServer:
    def __init__(self) -> None:
        self._watch_tasks: dict[int, asyncio.Task] = {}
        self._running = True

    async def run(self) -> None:
        loop = asyncio.get_running_loop()
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        # NOTE: connect_read_pipe is POSIX-only; Windows needs a thread reader.
        await loop.connect_read_pipe(lambda: protocol, sys.stdin)

        while self._running:
            line = await reader.readline()
            if not line:
                break  # stdin closed: parent process is gone
            message = line.decode("utf-8").strip()
            if message:
                await self._handle_line(message)

        self._cancel_all_watches()

    async def _handle_line(self, line: str) -> None:
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            self._send(_error(None, PARSE_ERROR, "parse error"))
            return
        response = await self.dispatch(message)
        if response is not None:
            self._send(response)

    async def dispatch(self, message: dict) -> dict | None:
        """Route a single request/notification. Returns None for notifications."""
        method = message.get("method")
        msg_id = message.get("id")
        params = message.get("params") or {}

        handler = self._handlers().get(method)
        if handler is None:
            return _error(msg_id, METHOD_NOT_FOUND, f"method not found: {method}")

        try:
            result = await handler(params)
        except ValueError as exc:
            return _error(msg_id, INVALID_PARAMS, str(exc))
        except Exception as exc:  # noqa: BLE001 — process boundary: report, never crash
            return _error(msg_id, INTERNAL_ERROR, str(exc))

        if msg_id is None:
            return None
        return {"jsonrpc": "2.0", "id": msg_id, "result": result}

    def _handlers(self):
        return {
            "system.ping": self._ping,
            "system.shutdown": self._shutdown,
            "device.watch": self._watch,
            "device.unwatch": self._unwatch,
            "acquisition.simulatedPoll": self._simulated_poll,
        }

    async def _ping(self, _params: dict) -> dict:
        return {
            "status": "ok",
            "pythonVersion": platform.python_version(),
            "pid": os.getpid(),
        }

    async def _shutdown(self, _params: dict) -> dict:
        self._running = False
        return {"status": "stopping"}

    async def _watch(self, params: dict) -> dict:
        """Start live polling for a device (ephemeral, never persisted).

        params:
            deviceId    (int, required) — positive integer device identifier.
            registerMap (dict, required) — validated RegisterMap payload,
                resolved by packages/core from the device's meter model
                (python never touches app.db, see docs/ARCHITECTURE.md §11).
        """
        device_id = _require_device_id(params)
        register_map = _require_register_map(params)
        if device_id not in self._watch_tasks:
            reader = SimulatedReader()
            service = LiveWatchService(reader)
            task = asyncio.get_running_loop().create_task(
                service.run(device_id, register_map, self._on_live_reading, LIVE_INTERVAL_SECONDS)
            )
            self._watch_tasks[device_id] = task
        self.notify("device.status", {"deviceId": device_id, "state": "connected"})
        return {"watching": device_id}

    async def _unwatch(self, params: dict) -> dict:
        device_id = _require_device_id(params)
        task = self._watch_tasks.pop(device_id, None)
        if task:
            task.cancel()
        self.notify("device.status", {"deviceId": device_id, "state": "disconnected"})
        return {"watching": None}

    def _on_live_reading(self, batch: list[Reading]) -> None:
        """Translate one tick's worth of Readings into `device.reading` events."""
        for reading in batch:
            self.notify(
                "device.reading",
                {
                    "deviceId": reading.device_id,
                    "metric": reading.metric,
                    "timestamp": reading.timestamp,
                    "value": reading.value,
                },
            )

    async def _simulated_poll(self, params: dict) -> dict:
        """Run a simulated Modbus poll and persist results to telemetry.db.

        params:
            deviceId  (int, required) — positive integer device identifier.
            registerMap (dict, required) — validated RegisterMap payload.
            ticks (int, optional, 1–1000, default 10) — number of poll cycles.

        Returns a summary dict with inserted/ignored/ticks/metrics counts.
        """
        # ── validate deviceId ──────────────────────────────────────────────────
        device_id = _require_device_id(params)

        # ── validate ticks ─────────────────────────────────────────────────────
        raw_ticks = params.get("ticks", 10)
        if not isinstance(raw_ticks, int) or isinstance(raw_ticks, bool):
            raise ValueError("ticks must be an integer")  # noqa: TRY004 — ValueError maps to INVALID_PARAMS
        if raw_ticks < 1 or raw_ticks > 1000:
            raise ValueError("ticks must be between 1 and 1000")
        ticks: int = raw_ticks

        # ── validate registerMap ───────────────────────────────────────────────
        register_map = _require_register_map(params)

        # ── resolve DB path ────────────────────────────────────────────────────
        db_path = os.environ.get("TELEMETRY_DB_PATH")
        if not db_path:
            raise ValueError("TELEMETRY_DB_PATH env var not set")

        # ── migrate + write ────────────────────────────────────────────────────
        apply_migrations(db_path)
        writer = SqliteTelemetryWriter(db_path)
        reader = SimulatedReader()

        all_readings = []
        base_ts_origin = int(time.time() * 1000)
        for tick in range(1, ticks + 1):
            base_ts = base_ts_origin + (tick - 1) * 1000
            batch = reader.read(device_id, register_map, tick, base_ts)
            all_readings.extend(batch)

        result = writer.write_batch(all_readings)
        return {
            "inserted": result.inserted,
            "ignored": result.ignored,
            "ticks": ticks,
            "metrics": len(register_map.registers),
        }

    def notify(self, method: str, params: dict) -> None:
        self._send({"jsonrpc": "2.0", "method": method, "params": params})

    def _send(self, message: dict) -> None:
        sys.stdout.write(json.dumps(message) + "\n")
        sys.stdout.flush()

    def _cancel_all_watches(self) -> None:
        for task in self._watch_tasks.values():
            task.cancel()
        self._watch_tasks.clear()


def _require_device_id(params: dict) -> int:
    device_id = params.get("deviceId")
    if not isinstance(device_id, int) or isinstance(device_id, bool) or device_id <= 0:
        raise ValueError("deviceId must be a positive integer")
    return device_id


def _require_register_map(params: dict) -> RegisterMap:
    raw_map = params.get("registerMap")
    if not isinstance(raw_map, dict):
        raise ValueError("registerMap must be an object")  # noqa: TRY004 — ValueError maps to INVALID_PARAMS
    try:
        return RegisterMap.model_validate(raw_map)
    except Exception as exc:
        raise ValueError(f"invalid registerMap: {exc}") from exc


def _error(msg_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}
