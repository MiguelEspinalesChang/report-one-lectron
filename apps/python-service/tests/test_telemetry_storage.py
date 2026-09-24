"""Tests for telemetry.db migrations and the SQLite batch writer.

All tests use a temporary file (tmp_path fixture) so they are isolated and
leave no artefacts. We test a real SQLite file rather than mocking because
the storage adapter IS the integration layer — mocking sqlite3 here would
test nothing useful.
"""

from __future__ import annotations

import sqlite3

import pytest

from storage.adapters.sqlite_writer import SqliteTelemetryWriter
from storage.domain import Reading
from storage.migrations import CURRENT_SCHEMA_VERSION, apply_migrations

# ── Helpers ───────────────────────────────────────────────────────────────────


def _conn(db_path: str) -> sqlite3.Connection:
    """Open a read connection for assertions."""
    return sqlite3.connect(db_path)


def _table_names(db_path: str) -> set[str]:
    conn = _conn(db_path)
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    conn.close()
    return {r[0] for r in rows}


def _index_names(db_path: str) -> set[str]:
    conn = _conn(db_path)
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()
    conn.close()
    return {r[0] for r in rows}


def _schema_version(db_path: str) -> int:
    conn = _conn(db_path)
    row = conn.execute(
        "SELECT value FROM schema_meta WHERE key='schema_version'"
    ).fetchone()
    conn.close()
    return int(row[0]) if row else 0


def _wal_mode(db_path: str) -> str:
    conn = _conn(db_path)
    row = conn.execute("PRAGMA journal_mode").fetchone()
    conn.close()
    return row[0]


# ── Migration tests ────────────────────────────────────────────────────────────


def test_migrations_create_all_tables(tmp_path):
    db_path = str(tmp_path / "telemetry.db")
    apply_migrations(db_path)

    tables = _table_names(db_path)
    assert "readings" in tables
    assert "readings_1m" in tables
    assert "readings_1h" in tables
    assert "schema_meta" in tables


def test_migrations_create_index(tmp_path):
    db_path = str(tmp_path / "telemetry.db")
    apply_migrations(db_path)

    indexes = _index_names(db_path)
    assert "idx_readings_dev_ts" in indexes


def test_migrations_wal_mode_enabled(tmp_path):
    db_path = str(tmp_path / "telemetry.db")
    apply_migrations(db_path)

    # WAL is set per-connection; confirm the migration engine opened WAL.
    # A fresh connection after the fact reflects the persisted mode.
    assert _wal_mode(db_path) == "wal"


def test_migrations_set_schema_version(tmp_path):
    db_path = str(tmp_path / "telemetry.db")
    apply_migrations(db_path)

    assert _schema_version(db_path) == CURRENT_SCHEMA_VERSION


def test_migrations_idempotent(tmp_path):
    """Running apply_migrations twice must not raise and must not alter version."""
    db_path = str(tmp_path / "telemetry.db")
    apply_migrations(db_path)
    apply_migrations(db_path)  # second call — must be a no-op

    assert _schema_version(db_path) == CURRENT_SCHEMA_VERSION
    assert "readings" in _table_names(db_path)


# ── SqliteTelemetryWriter tests ────────────────────────────────────────────────


@pytest.fixture()
def db_path(tmp_path):
    path = str(tmp_path / "telemetry.db")
    apply_migrations(path)
    return path


@pytest.fixture()
def writer(db_path):
    return SqliteTelemetryWriter(db_path)


def _make_reading(
    device_id: int = 1,
    metric: str = "voltage_l1",
    timestamp: int = 1_700_000_000_000,
    value: float = 220.0,
    source: str = "simulated",
) -> Reading:
    return Reading(
        device_id=device_id,
        metric=metric,
        timestamp=timestamp,
        value=value,
        source=source,
    )


def test_write_batch_inserts_readings(db_path, writer):
    readings = [
        _make_reading(timestamp=1_700_000_000_000, value=220.1),
        _make_reading(timestamp=1_700_000_001_000, value=220.2),
        _make_reading(timestamp=1_700_000_002_000, value=220.3),
    ]
    result = writer.write_batch(readings)

    assert result.inserted == 3
    assert result.ignored == 0
    assert result.total == 3

    conn = _conn(db_path)
    count = conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
    conn.close()
    assert count == 3


def test_write_batch_deduplicates_via_insert_or_ignore(db_path, writer):
    """Sending the same reading twice must result in one row, not two."""
    reading = _make_reading(timestamp=1_700_000_000_000)
    result1 = writer.write_batch([reading])
    result2 = writer.write_batch([reading])  # exact duplicate

    assert result1.inserted == 1
    assert result1.ignored == 0

    assert result2.inserted == 0
    assert result2.ignored == 1

    conn = _conn(db_path)
    count = conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
    conn.close()
    assert count == 1  # still one row


def test_write_batch_partial_dedup(db_path, writer):
    """Batch with mix of new and duplicate rows: new ones insert, dupes are ignored."""
    existing = _make_reading(timestamp=1_700_000_000_000, value=220.0)
    writer.write_batch([existing])

    # Second batch: one duplicate + two new
    batch = [
        existing,  # duplicate
        _make_reading(timestamp=1_700_000_001_000, value=221.0),
        _make_reading(timestamp=1_700_000_002_000, value=222.0),
    ]
    result = writer.write_batch(batch)

    assert result.inserted == 2
    assert result.ignored == 1

    conn = _conn(db_path)
    count = conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
    conn.close()
    assert count == 3  # 1 pre-existing + 2 new


def test_write_empty_batch_returns_zero_counts(db_path, writer):
    result = writer.write_batch([])
    assert result.inserted == 0
    assert result.ignored == 0


def test_write_batch_multiple_devices_and_metrics(db_path, writer):
    readings = [
        _make_reading(device_id=1, metric="voltage_l1", timestamp=1_000, value=220.0),
        _make_reading(device_id=1, metric="current_l1", timestamp=1_000, value=10.5),
        _make_reading(device_id=2, metric="voltage_l1", timestamp=1_000, value=221.0),
    ]
    result = writer.write_batch(readings)

    # All three are distinct by (device_id, metric, timestamp)
    assert result.inserted == 3
    assert result.ignored == 0


# ── source CHECK constraint (DB-layer defense) ─────────────────────────────────


def test_source_check_rejects_invalid_value(db_path):
    """The readings.source CHECK must reject a value outside the allowed set.

    Reading.source is a Literal (static defense), but that is not enforced at
    runtime by the dataclass. This test writes a bad source directly via SQL to
    prove the DB-layer CHECK constraint is the real guard.
    """
    conn = _conn(db_path)
    try:
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO readings (device_id, metric, timestamp, value, source) "
                "VALUES (?, ?, ?, ?, ?)",
                (1, "voltage_l1", 1_000, 220.0, "poll"),  # 'poll' is not valid
            )
    finally:
        conn.close()


def test_source_check_accepts_valid_values(db_path):
    """All three canonical sources must pass the CHECK."""
    conn = _conn(db_path)
    try:
        for i, source in enumerate(("polling", "csv_import", "simulated")):
            conn.execute(
                "INSERT INTO readings (device_id, metric, timestamp, value, source) "
                "VALUES (?, ?, ?, ?, ?)",
                (1, "voltage_l1", 1_000 + i, 220.0, source),
            )
        conn.commit()
        count = conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
        assert count == 3
    finally:
        conn.close()
