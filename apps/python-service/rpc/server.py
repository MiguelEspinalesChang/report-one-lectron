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
import random
import sys
import time

PARSE_ERROR = -32700
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603

# Demo cadence for fake live readings until real Modbus acquisition lands.
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
        device_id = _require_device_id(params)
        if device_id not in self._watch_tasks:
            task = asyncio.get_running_loop().create_task(self._emit_readings(device_id))
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

    async def _emit_readings(self, device_id: int) -> None:
        """Fake live readings until real Modbus acquisition replaces this."""
        while True:
            self.notify(
                "device.reading",
                {
                    "deviceId": device_id,
                    "metric": "voltage",
                    "timestamp": int(time.time() * 1000),
                    "value": round(random.uniform(219.0, 231.0), 2),
                },
            )
            await asyncio.sleep(LIVE_INTERVAL_SECONDS)

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


def _error(msg_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}
