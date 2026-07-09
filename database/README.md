# Database migrations

Two SQLite files, both in WAL mode, each with a single owner process:

| File | Owner (writer) | Migrations |
|---|---|---|
| `app.db` | `packages/core` (Node, Drizzle) | `migrations/app/` |
| `telemetry.db` | `apps/python-service` | `migrations/telemetry/` |

`packages/core` reads `telemetry.db` (aggregated queries only) but never
writes to it.

## Gotcha: `COLLATE NOCASE` on `users.username`

Drizzle cannot express `COLLATE NOCASE` in the schema, so it lives only in
the migration SQL (`0001_*.sql`, on both the column and the unique index).
If you ever regenerate that migration with `drizzle-kit generate`, the
collation is silently lost and username lookups become case-sensitive.
Never regenerate an applied migration — add a new one, and re-apply the
collation by hand if the column is recreated.
