"""telemetry.db migration engine.

Applies the schema at startup, idempotent. Version is tracked in schema_meta.
Called from main.py with the resolved db_path — never hardcoded here.

WAL mode and busy_timeout are enabled on every connection open.
"""

from __future__ import annotations

import logging
import sqlite3

logger = logging.getLogger(__name__)

# Increment when adding new migrations to _MIGRATIONS.
CURRENT_SCHEMA_VERSION = 1

# Each entry is (version: int, sql: str). Applied in order, once.
# Using executescript so each block can contain multiple statements.
_MIGRATIONS: list[tuple[int, str]] = [
    (
        1,
        """
        CREATE TABLE IF NOT EXISTS schema_meta (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        ) STRICT;

        CREATE TABLE IF NOT EXISTS readings (
            device_id  INTEGER NOT NULL,
            metric     TEXT    NOT NULL,
            timestamp  INTEGER NOT NULL,
            value      REAL    NOT NULL,
            source     TEXT    NOT NULL
                       CHECK (source IN ('polling', 'csv_import', 'simulated')),
            UNIQUE (device_id, metric, timestamp)
        ) STRICT;

        CREATE INDEX IF NOT EXISTS idx_readings_dev_ts
            ON readings (device_id, timestamp);

        CREATE TABLE IF NOT EXISTS readings_1m (
            device_id INTEGER NOT NULL,
            metric    TEXT    NOT NULL,
            bucket    INTEGER NOT NULL,
            min       REAL    NOT NULL,
            max       REAL    NOT NULL,
            avg       REAL    NOT NULL,
            count     INTEGER NOT NULL,
            PRIMARY KEY (device_id, metric, bucket)
        ) STRICT;

        CREATE TABLE IF NOT EXISTS readings_1h (
            device_id INTEGER NOT NULL,
            metric    TEXT    NOT NULL,
            bucket    INTEGER NOT NULL,
            min       REAL    NOT NULL,
            max       REAL    NOT NULL,
            avg       REAL    NOT NULL,
            count     INTEGER NOT NULL,
            PRIMARY KEY (device_id, metric, bucket)
        ) STRICT;
        """,
    ),
]


def _open(db_path: str, busy_timeout_ms: int) -> sqlite3.Connection:
    """Open a WAL-mode connection with the configured busy timeout."""
    conn = sqlite3.connect(db_path)
    conn.execute(f"PRAGMA busy_timeout = {busy_timeout_ms}")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _get_version(conn: sqlite3.Connection) -> int:
    """Read schema_version from schema_meta; returns 0 if the table is absent."""
    try:
        row = conn.execute(
            "SELECT value FROM schema_meta WHERE key = 'schema_version'"
        ).fetchone()
        return int(row[0]) if row else 0
    except sqlite3.OperationalError:
        # schema_meta does not exist yet (fresh DB).
        return 0


def _set_version(conn: sqlite3.Connection, version: int) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', ?)",
        (str(version),),
    )


def apply_migrations(db_path: str, *, busy_timeout_ms: int = 5000) -> None:
    """Ensure telemetry.db schema is up to date.

    Safe to call on every startup: migrations that are already applied are
    skipped. The version stored in schema_meta is the ground truth.

    Args:
        db_path: absolute path to telemetry.db (injected by caller, not hardcoded).
        busy_timeout_ms: SQLite busy_timeout for concurrent access.
    """
    conn = _open(db_path, busy_timeout_ms)
    try:
        current = _get_version(conn)
        pending = [(v, sql) for v, sql in _MIGRATIONS if v > current]

        if not pending:
            logger.debug("telemetry.db schema is current (version=%d)", current)
            return

        for version, sql in pending:
            logger.info("Applying telemetry.db migration v%d", version)
            # executescript commits any open transaction first, then runs DDL.
            conn.executescript(sql)
            # executescript auto-commits; open an explicit transaction for the
            # version bump so it's atomic with the DDL on the same connection.
            with conn:
                _set_version(conn, version)

        logger.info(
            "telemetry.db schema migrated from v%d to v%d", current, CURRENT_SCHEMA_VERSION
        )
    finally:
        conn.close()
