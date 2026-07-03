# Database migrations

Two SQLite files, both in WAL mode, each with a single owner process:

| File | Owner (writer) | Migrations |
|---|---|---|
| `app.db` | `packages/core` (Node, Drizzle) | `migrations/app/` |
| `telemetry.db` | `apps/python-service` | `migrations/telemetry/` |

`packages/core` reads `telemetry.db` (aggregated queries only) but never
writes to it.
