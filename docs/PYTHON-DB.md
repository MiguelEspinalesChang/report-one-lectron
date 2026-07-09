# Conexión Python ↔ Bases de datos

El sidecar Python es el **único escritor** de `telemetry.db`; `packages/core` (Node) es el **único escritor** de `app.db` y solo **lee** `telemetry.db` en modo readonly. Python nunca toca `app.db`: toda configuración que necesita (mapa de registros, dispositivo a pollear) le llega como parámetro por JSON-RPC. Este documento explica cómo se cablea esa propiedad en el código real.

## Vista rápida

```
                 app.db (WAL)                          telemetry.db (WAL)
                 ▲ escribe                             ▲ escribe (único)
                 │                                     │
Vue ──IPC──▶ Electron main ──▶ packages/core ──JSON-RPC stdio──▶ sidecar Python
                 │                   │ lee (readonly + query_only)
                 │                   ▼
                 │              telemetry.db
                 └── inyecta TELEMETRY_DB_PATH al spawn del sidecar
```

| Aspecto | Decisión |
|---|---|
| Quién decide la ruta de `telemetry.db` | Electron main: `path.join(app.getPath('userData'), 'telemetry.db')` en `apps/electron/main/index.ts` |
| Cómo la recibe Python | Variable de entorno `TELEMETRY_DB_PATH`, inyectada en el spawn (`apps/electron/main/python-manager.ts`) |
| Migraciones de `telemetry.db` | Las aplica Python (`storage/migrations.py`), idempotentes, versionadas en `schema_meta` |
| Migraciones de `app.db` | Las aplica core (drizzle) al arrancar, ANTES de spawnear el sidecar |
| Escritura de telemetría | `SqliteTelemetryWriter` en Python: batch en una transacción, `INSERT OR IGNORE` |
| Lectura de histórico | Core lee `telemetry.db` directo con better-sqlite3 (`readonly: true` + `PRAGMA query_only = ON`) — no pasa por Python |
| Datos masivos entre procesos | Nunca cruzan: el RPC devuelve solo resúmenes (`{inserted, ignored, ticks, metrics}`) |
| Concurrencia entre escritor y lector | WAL + `busy_timeout = 5000` en ambos lados |

## Arranque del sidecar

1. `app.whenReady()` en `apps/electron/main/index.ts` crea core (`createCore({ database, telemetryDbPath })`) — esto corre las migraciones de `app.db` — y luego instancia `PythonManager`.
2. `PythonManager.start()` (`apps/electron/main/python-manager.ts`) resuelve el intérprete con `resolvePythonBin` (orden: `PYTHON_BIN` → `.venv` del servicio → `python3` del sistema) y spawnea `main.py` con el entorno `{ ...process.env, TELEMETRY_DB_PATH: <userData>/telemetry.db }`.
3. `PythonBridge.attach(child.stdin, child.stdout)` conecta el protocolo al stdio del hijo.
4. Las migraciones de `telemetry.db` corren de forma **perezosa**: `apply_migrations(db_path)` se invoca al inicio de cada handler que escribe (hoy `acquisition.simulatedPoll`). Es idempotente: lee la versión en `schema_meta` y no hace nada si ya está al día. El efecto neto equivale a "migrar al arranque" porque la env var existe desde el spawn.

## Capa JSON-RPC

Transporte: JSON delimitado por newline sobre stdio. Sin framing adicional.

| Lado | Dueño | Responsabilidad |
|---|---|---|
| Node | `packages/core/src/python-bridge/client.ts` (`PythonBridge`) | `request()` con id incremental y timeout (10 s default), `notify()`, parseo por línea, evento `'notification'` para push, `detach()` rechaza pendientes |
| Python | `apps/python-service/rpc/server.py` (`RpcServer`) | Loop asyncio sobre stdin, dispatch por `method`, `_send()` escribe a stdout. **stdout es exclusivo del JSON-RPC; los logs van a stderr** |

Los nombres de método viven en `RpcMethods` (`packages/shared-types/src/index.ts`) y Python los replica **a mano** en el dict `_handlers()` de `server.py`. Cambiar un lado sin el otro rompe en silencio — verificar ambos siempre.

## Camino de escritura (poll simulado)

```
AcquisitionService.runSimulatedPoll()          packages/core/src/acquisition/acquisition-service.ts
  └─ bridge.request('acquisition.simulatedPoll', params, 30s)
       └─ RpcServer._simulated_poll()          apps/python-service/rpc/server.py
            ├─ valida params (pydantic RegisterMap.model_validate)
            ├─ apply_migrations(TELEMETRY_DB_PATH)     storage/migrations.py (idempotente)
            ├─ SimulatedReader.read() por tick         acquisition/adapters/simulated_reader.py
            │    └─ un Reading por registro del mapa (determinístico: seno + fase por hash,
            │       energía monotónica tick * 0.25 * scale — sin módulo random)
            └─ SqliteTelemetryWriter.write_batch()     storage/adapters/sqlite_writer.py
                 ├─ abre conexión (WAL + busy_timeout 5000)
                 ├─ UNA transacción: executemany(INSERT OR IGNORE INTO readings ...)
                 ├─ inserted/ignored vía delta de conn.total_changes
                 └─ cierra conexión
```

- **Deduplicación**: `INSERT OR IGNORE` + `UNIQUE(device_id, metric, timestamp)` — re-enviar un batch no duplica filas.
- **Respuesta RPC**: solo el resumen `{inserted, ignored, ticks, metrics}`. Las lecturas nunca vuelven por el pipe.
- Los puertos son Protocols de Python: `TelemetryWriter` (`storage/ports.py`) y `ModbusReader` (`acquisition/ports.py`). El simulador implementa el mismo puerto que implementará el lector Modbus real.

## Camino de lectura (histórico)

Core **no** le pide el histórico a Python: abre `telemetry.db` directamente en modo solo-lectura.

- Puerto: `TelemetryReader` (`packages/core/src/telemetry/ports/telemetry-reader.ts`).
- Adaptador: `SqliteTelemetryReader` (`packages/core/src/telemetry/adapters/sqlite-telemetry-reader.ts`) — `new Database(dbPath, { readonly: true })` + `PRAGMA query_only = ON`. Imposible escribir por accidente.
- **Conexión perezosa**: el archivo lo crea Python en su primera escritura, y core puede arrancar antes de eso. El reader abre la conexión en el primer `getHistory`; si el archivo no existe (o aún no tiene la tabla `readings`), devuelve historial vacío en vez de reventar el arranque.
- `getHistory({ deviceId, metric, fromMs, toMs, bucketMs })` agrega al vuelo sobre `readings` (min/max/avg/count por bucket), usando el índice `idx_readings_dev_ts`.
- Las tablas `readings_1m`/`readings_1h` existen en el esquema pero todavía no se pueblan (el job de downsampling es trabajo futuro); por eso la agregación es on-the-fly.
- Gracias a WAL, el lector ve siempre el último snapshot consistente aunque Python esté escribiendo en ese momento.

## Contrato del mapa de registros (validación doble)

El mapa vive en `app.db` (`meter_models.register_map`, JSON) y viaja a Python como parámetro RPC — Python jamás lee `app.db`.

| Capa | Esquema | Cuándo valida |
|---|---|---|
| Frontera IPC / guardado | zod `RegisterMapSchema` (`packages/shared-types/src/catalog-schemas.ts`) | Al guardar el mapa en el catálogo |
| Dominio de core | `catalog/domain/validators.ts` | Invariante propia de core como librería |
| Python | pydantic `RegisterMap` (`apps/python-service/acquisition/profiles/register_map.py`) | Al recibir el RPC, antes de tocar la DB |

Reglas espejadas: `version` exactamente 1 (`z.literal(1)` / `Literal[1]`), `address` 0–65535, `registers` no vacío, métricas únicas, mismos enums de `function`/`datatype`/`wordOrder`. Pydantic acepta `wordOrder` y `word_order` vía `AliasChoices`. Un mapa inválido explota al **guardarse** o al entrar al RPC — nunca durante el polling. El campo `metric` es el puente: el mismo string canónico termina en `readings.metric`.

`AcquisitionService.runSimulatedPoll` valida el mapa completo con `validateRegisterMap` (dominio de core) ANTES de enviarlo por RPC — un mapa inválido nunca cruza el pipe.

## Esquema de `telemetry.db` (migración v1)

```sql
CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;

CREATE TABLE readings (
  device_id  INTEGER NOT NULL,
  metric     TEXT    NOT NULL,   -- nombre canónico del mapa de registros
  timestamp  INTEGER NOT NULL,   -- epoch ms
  value      REAL    NOT NULL,
  source     TEXT    NOT NULL CHECK (source IN ('polling', 'csv_import', 'simulated')),
  UNIQUE (device_id, metric, timestamp)
) STRICT;
CREATE INDEX idx_readings_dev_ts ON readings (device_id, timestamp);

-- Agregados (aún sin poblar; los llenará el job de downsampling)
CREATE TABLE readings_1m (
  device_id INTEGER NOT NULL, metric TEXT NOT NULL, bucket INTEGER NOT NULL,
  min REAL NOT NULL, max REAL NOT NULL, avg REAL NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY (device_id, metric, bucket)
) STRICT;
-- readings_1h: misma forma, bucket por hora
```

Sin FK hacia `app.db` (son archivos separados): `device_id` es referencia lógica; la integridad la garantiza el flujo — Python solo pollea dispositivos que core le configuró.

## Crash y reinicio

- Si el sidecar muere, `PythonManager.handleExit` hace `bridge.detach()` (rechaza todos los RPC pendientes) y reintenta el spawn hasta 5 veces con 1 s de espera. El proceso nuevo hereda `TELEMETRY_DB_PATH` y re-aplica migraciones (no-op) en el siguiente RPC.
- WAL es crash-safe: una transacción incompleta se revierte sola en la próxima apertura. El batch es todo-o-nada (`with conn:` = BEGIN/COMMIT explícito).
- Apagado limpio: `before-quit` → `python.stop()` → `detach()` + `kill()`; el loop de Python sale cuando stdin se cierra.

## Checklist al tocar esta frontera

- [ ] ¿Agregaste un método RPC? `RpcMethods` (shared-types) y `_handlers()` (server.py) deben coincidir string por string — seguir `.claude/skills/add-rpc-method/SKILL.md`.
- [ ] ¿Cambiaste el mapa de registros? Actualizar zod (shared-types), validadores de core y pydantic (Python) — las tres capas.
- [ ] ¿Cambiaste el esquema de `telemetry.db`? Nueva migración versionada en `storage/migrations.py`; nunca editar la v1.
- [ ] ¿Core necesita datos de telemetría? Leer con `SqliteTelemetryReader` (readonly) o pedir resúmenes por RPC — nunca abrir la DB en modo escritura desde Node.
- [ ] stdout del sidecar sigue siendo solo JSON-RPC (logs a stderr).
