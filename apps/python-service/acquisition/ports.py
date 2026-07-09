"""Acquisition ports — typing.Protocol contracts.

Adapters (real pymodbus reader, simulated reader) implement these.
Domain and service layers depend ONLY on these interfaces.
"""

from __future__ import annotations

from typing import Protocol

from acquisition.profiles.register_map import RegisterMap
from storage.domain import Reading


class ModbusReader(Protocol):
    """Contract that every Modbus reader adapter must satisfy.

    tick — monotonic integer counter used by the caller; deterministic
    value generation strategies (simulated, replay) use it as their
    primary time dimension instead of wall-clock randomness.
    """

    def read(self, device_id: int, register_map: RegisterMap, tick: int) -> list[Reading]:
        """Read all registers in the map and return normalized Reading objects.

        Args:
            device_id: logical device identifier (FK reference to app.db).
            register_map: validated profile describing which registers to read.
            tick: monotonic integer counter; callers increment it each poll cycle.

        Returns:
            One Reading per register entry in register_map, with engineering
            values already scaled. Empty list only on total communication failure.
        """
        ...
