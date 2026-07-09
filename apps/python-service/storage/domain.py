"""Telemetry storage domain — pure types, no I/O.

Reading is the canonical unit that crosses every storage boundary.
BatchResult carries the outcome of a single write_batch call.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Source = Literal["polling", "csv_import", "simulated"]


@dataclass(frozen=True, slots=True)
class Reading:
    """One measurement from a device, normalised to canonical form.

    device_id  -- FK to app.db devices (logical reference, no FK constraint here)
    metric     -- canonical metric name from the register map (e.g. 'voltage_l1')
    timestamp  -- epoch milliseconds (INTEGER in SQLite STRICT)
    value      -- engineering value after scale applied
    source     -- 'polling' | 'csv_import' | 'simulated' (mirrored by a DB CHECK)
    """

    device_id: int
    metric: str
    timestamp: int
    value: float
    source: Source


@dataclass(frozen=True, slots=True)
class BatchResult:
    """Outcome of a single write_batch call."""

    inserted: int
    ignored: int  # duplicates dropped by UNIQUE + INSERT OR IGNORE

    @property
    def total(self) -> int:
        return self.inserted + self.ignored
