"""SQLite adapter for TelemetryWriter port.

This is the ONLY file in the sidecar that imports sqlite3 for writes.
It satisfies the TelemetryWriter protocol via structural subtyping.
"""

from __future__ import annotations

import logging
import sqlite3

from storage.domain import BatchResult, Reading

logger = logging.getLogger(__name__)

_INSERT_SQL = """
    INSERT OR IGNORE INTO readings (device_id, metric, timestamp, value, source)
    VALUES (?, ?, ?, ?, ?)
"""


class SqliteTelemetryWriter:
    """Writes batches of readings to telemetry.db in a single transaction.

    The UNIQUE(device_id, metric, timestamp) constraint deduplicates silently:
    INSERT OR IGNORE drops the row without raising an error.

    SQLite does not expose per-row insert/ignore counts directly, so we use
    conn.total_changes before/after the executemany to compute the delta.
    """

    def __init__(self, db_path: str, *, busy_timeout_ms: int = 5000) -> None:
        self._db_path = db_path
        self._busy_timeout_ms = busy_timeout_ms

    # Satisfy TelemetryWriter Protocol (structural subtyping — no explicit base).
    def write_batch(self, readings: list[Reading]) -> BatchResult:
        """Persist *readings* in one transaction; duplicates are ignored silently."""
        if not readings:
            return BatchResult(inserted=0, ignored=0)

        rows = [
            (r.device_id, r.metric, r.timestamp, r.value, r.source) for r in readings
        ]

        conn = self._connect()
        try:
            before = conn.total_changes
            with conn:  # auto-commit on success, rollback on exception
                conn.executemany(_INSERT_SQL, rows)
            after = conn.total_changes
            inserted = after - before
            ignored = len(readings) - inserted
            logger.debug(
                "write_batch: %d readings → %d inserted, %d ignored",
                len(readings),
                inserted,
                ignored,
            )
            return BatchResult(inserted=inserted, ignored=ignored)
        finally:
            conn.close()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.execute(f"PRAGMA busy_timeout = {self._busy_timeout_ms}")
        conn.execute("PRAGMA journal_mode = WAL")
        return conn
