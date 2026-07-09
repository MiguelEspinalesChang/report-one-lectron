# Progreso: Modelado de base de datos

> Rama: `feature/db-architecture` — trabajo commiteado en 7 commits agrupados por feature (`abf4c3d..e34e74c`).
> Plan de referencia: `docs/features/db-architecture-done.md`
> Lo pendiente de Fase 4 ahora se trackea en `docs/features/vue-backend-integration.md` §5.
> Última actualización: 2026-07-09

## Tareas realizadas

### ✅ Fase 0 — Infraestructura de persistencia en core (aprobada por arch-guard)

- `better-sqlite3` + `drizzle-orm`/`drizzle-kit` en `packages/core`; `better-sqlite3: true` en `allowBuilds` (pnpm-workspace.yaml).
- Módulo hexagonal `packages/core/src/persistence/`: puerto `AppDatabaseHandle` (limpio: `runMigrations()`/`close()`), adaptador `createAppDatabase({ filePath })` con WAL + `busy_timeout`, schema drizzle en `adapters/schema.ts`.
- Migraciones en `database/migrations/app/` (baseline `schema_meta`).
- Problema del ABI de Electron resuelto: scripts `rebuild:electron` / `rebuild:node` con resolución dinámica de versiones y rutas (`scripts/rebuild-node-sqlite.sh`). Ciclo verificado ida y vuelta; gotchas documentados en `CLAUDE.md`.
- Verificación: tests, build y lint en verde. Revisión arch-guard: **APPROVE** (tras corregir 2 críticos + 3 warnings).

### ✅ Fase 1 — Auth: usuarios, roles, permisos, login (aprobada por arch-guard)

- Migración `0001` con `roles`, `permissions`, `role_permissions`, `users` (+ `must_change_password`, username `COLLATE NOCASE`).
- Seed idempotente: 7 permisos; roles de sistema `admin`/`operator`/`viewer`; usuario inicial `admin`/`admin` con cambio de contraseña forzado.
- Feature hexagonal `packages/core/src/auth/`: dominio (User, AuthSession en memoria, política de contraseñas min 8), puertos (`UserRepository`, `PasswordHasher`), casos de uso (login/logout/getSession/changePassword/createUser/listUsers/assignRole), adaptadores (argon2id, repositorios drizzle, seed).
- Seguridad: `passwordHash` nunca cruza IPC (`PublicUser`), error genérico de credenciales, mitigación de timing attack con hash dummy real.
- Contratos `auth:*`/`users:*` en `packages/shared-types` con zod; handlers de una línea en Electron; API en el preload; cableado de arranque (main crea la DB en `userData`, corre migraciones + seed, cierra al salir).
- `argon2` es N-API: el mismo binario sirve para Node y Electron, sin rebuild (a diferencia de better-sqlite3).
- Verificación: 37/37 tests, build, lint y smoke test del bundle CJS en verde.

### ✅ Fase 2 — Catálogo de medidores (aprobada por arch-guard)

- Migración `0002` con `brands`, `meter_models` (con `register_map` JSON), `devices` según plan §3.3.
- Contrato del mapa de registros en `shared-types` (zod) como guardián del borde IPC + validación propia de core en `catalog/domain/validators.ts` (rechaza métricas duplicadas, array vacío, conexión que no matchea el transporte) — validación AL GUARDAR, core protege su invariante como librería.
- Feature hexagonal `packages/core/src/catalog/`: dominio, puertos, casos de uso CRUD (brands/models/devices) con specs, adaptadores drizzle, seed.
- Seed del medidor simulado: marca `Simulated`, modelo `SIM-100` (8 métricas canónicas), device `Test simulator` con transporte `simulated`.
- Contratos `catalog:*` en shared-types con zod; handlers de una línea con mappers DTO explícitos; preload sin casts.
- Verificación: 68/68 tests, build (7/7), lint verde. Corte de sesión a mitad no perdió trabajo (el árbol persiste); se reparó un import de `zod` en handlers moviéndolo a `ListModelsByBrandSchema` en shared-types.

### ✅ Fase 3 — `telemetry.db` en Python (aprobada por arch-guard)

- Módulo de migraciones idempotente (`storage/migrations.py`) aplicado al arranque, WAL + `busy_timeout`, versionado en `schema_meta`; path inyectado por el caller.
- Tablas `readings` (STRICT, UNIQUE(device_id,metric,timestamp), índice dev_ts, CHECK en `source`), `readings_1m`/`readings_1h`, `schema_meta`.
- `TelemetryWriter` Protocol + `SqliteTelemetryWriter` (batch en transacción única, `INSERT OR IGNORE`, cuenta inserted/ignored vía delta de `total_changes`).
- Validación pydantic del mapa de registros (`acquisition/profiles/register_map.py`) espejo del zod: rechaza métricas duplicadas, array vacío, `address` fuera de 0–65535; `AliasChoices` acepta `wordOrder`/`word_order`.
- Dominio puro (`Reading`, `BatchResult`), stdout solo JSON-RPC.
- Verificación: 28 tests pytest, ruff limpio.

## Tareas faltantes

### 🔴 Fase 4 — Medidor simulado end-to-end (EN CURSO)

Ya implementado (aprobado por arch-guard): `SimulatedReader` (determinístico: seno + fase por hash, energía monotónica, sin `random`), handler RPC `acquisition.simulatedPoll` (valida con pydantic, migra perezoso, batch a `telemetry.db`), `AcquisitionService` + `TelemetryService`/`SqliteTelemetryReader` (readonly) en core, inyección de `TELEMETRY_DB_PATH` en el spawn, test de integración sobre el sidecar real (`client.spec.ts`). Documentado en `docs/PYTHON-DB.md`.

Falta:

- Cablear la superficie IPC: handler en `handlers.ts` para `runSimulatedPoll` y exponer `acquisition`/`telemetry` en `PlatformApi` + preload (hoy el renderer no puede disparar polls ni consultar histórico).
- Reemplazar el placeholder de `device.watch` (`_emit_readings` usa `random.uniform`) por el `SimulatedReader` real.
- Loop de scheduler continuo (polling periódico según `polling_interval_s`).
- Job de downsampling que pueble `readings_1m`/`readings_1h` (hoy la agregación es on-the-fly sobre `readings`).

### 🔴 5. Commit final (bloqueado por 1–4)

- Con todas las fases terminadas y aprobadas por arch-guard: flujo `commit-flow` (verificación de rama, build + tests, commits agrupados por área con conventional commits + gitmoji). Pendiente definir idioma de los mensajes.

## Decisiones tomadas en el camino

- Transporte `csv` (2026-07-09): existe el caso de uso de medidores cuya data llega SOLO por CSV, sin conexión viva. Se agregó `'csv'` al contrato de transporte (zod en shared-types, `Transport` type, validadores de dominio en core) con `connection: {}`. Sin migración SQL (la columna es TEXT sin CHECK). El union de transporte se consolidó en un único `TransportSchema`/`Transport` en shared-types (antes estaba copiado en 7 lugares). Pendiente para la fase del importador: mapping columna CSV → métrica canónica y (opcional) tabla de auditoría de imports. El scheduler futuro debe saltear dispositivos `csv`.

- Matriz de roles por defecto (ajustable): `admin` = todo; `operator` = devices.manage/view, telemetry.view, reports.generate/view; `viewer` = solo lectura (devices.view, telemetry.view, reports.view).
- `InactiveUserError` se lanza solo DESPUÉS de verificar la contraseña (no revela estado de cuenta a quien no tiene credenciales).
- Las migraciones de `app.db` las inyecta Electron main (`migrationsFolder`); TODO(installer): empaquetar `database/migrations/app` como extraResources.
- `COLLATE NOCASE` del username vive solo en el SQL de la migración `0001` — drizzle no lo expresa; regenerar esa migración lo pierde en silencio (documentado en `database/README.md`).
