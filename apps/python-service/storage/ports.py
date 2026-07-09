"""Storage ports — typing.Protocol contracts.

Adapters import these and implement them.
Domain and service layers depend ONLY on these interfaces, never on sqlite3.
"""

from __future__ import annotations

from typing import Protocol

from storage.domain import BatchResult, Reading


class TelemetryWriter(Protocol):
    """Writes a batch of readings to persistent storage in a single transaction."""

    def write_batch(self, readings: list[Reading]) -> BatchResult:
        """Persist *readings* atomically.

        Uses INSERT OR IGNORE so duplicates (same device_id+metric+timestamp)
        are silently dropped — the UNIQUE constraint is the source of truth.

        Returns a BatchResult with inserted/ignored counts.
        """
        ...
