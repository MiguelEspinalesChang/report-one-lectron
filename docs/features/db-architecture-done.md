# Feature: Modelado de base de datos

> Estado: **PLANIFICADO — pendiente de orden de inicio**
> Rama: `feature/db-architecture`
> Documentos normativos: `docs/ARCHITECTURE.md` §6 (bases de datos), `docs/HEXAGONAL.md`

## 1. Problemática

1. **Volumen**: los medidores generan millones de registros por dispositivo. La tabla de lecturas no puede modelar variabilidad ni cargar estructura — tiene que ser angosta, tipada e indexada.
2. **Heterogeneidad por marca**: cada marca/modelo expone registros Modbus distintos (dirección, tipo de dato, orden de palabras, factor de escala, cantidad de campos). Esa variabilidad se modela como **configuración** (mapa de registros en JSON, bajo volumen), nunca en la tabla de lecturas.
3. **Sin hardware disponible**: no hay medidor físico todavía. Se define un **medidor simulado** como primera "marca" para desarrollar y probar el pipeline completo de punta a punta.

Principio rector: *la variabilidad vive en metadata (JSON validado); el dato caliente vive en tablas angostas y uniformes.*

## 2. Propiedad (no negociable, ARCHITECTURE.md §11)

| Archivo | Escritor único | Lectores |
|---|---|---|
| `app.db` | `packages/core` (Node, better-sqlite3 + Drizzle) | core |
| `telemetry.db` | sidecar Python (batch writer) | Python (RPC de histórico) y core (solo lectura con agregación) |

Ambos en modo WAL con `busy_timeout` configurado en todos los procesos.

## 3. Diseño `app.db` — negocio y configuración

### 3.1 Dominio: autenticación y autorización

Login **local y offline** (app de escritorio, sin servidor de identidad).

```sql
CREATE TABLE roles (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL UNIQUE,     -- 'admin' | 'operator' | 'viewer'
  description TEXT,
  is_system   INTEGER NOT NULL DEFAULT 0   -- roles sembrados, no borrables
);

CREATE TABLE permissions (
  id          INTEGER PRIMARY KEY,
  code        TEXT    NOT NULL UNIQUE,     -- 'devices.manage', 'reports.generate', 'users.manage', ...
  description TEXT
);

CREATE TABLE role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,           -- argon2id (ver decisiones abiertas)
  display_name  TEXT    NOT NULL,
  role_id       INTEGER NOT NULL REFERENCES roles(id),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,           -- epoch ms
  updated_at    INTEGER NOT NULL
);
```

Decisiones de diseño:

- **Un rol por usuario** (FK directa, no tabla puente). Es una app de escritorio con pocos usuarios; RBAC completo M:N es sobre-ingeniería hoy. Los permisos sí son M:N contra roles, así un rol nuevo se compone sin migrar.
- **Permisos como códigos estables** (`domain.action`). La UI y los handlers verifican por código; los roles son solo agrupadores.
- **Sesión en memoria del proceso main** (core). No hay tabla de sesiones: al cerrar la app muere la sesión. Si después se pide auditoría, se agrega `audit_log` — no antes.
- Seed inicial: rol `admin` con todos los permisos + usuario `admin` con contraseña inicial forzada a cambio en primer login.
- Verificación de contraseña y emisión de sesión ocurren en core; Electron main solo delega (handler de una línea); Vue solo pinta el formulario.

### 3.2 Dominio: configuración de la app

```sql
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,   -- 'locale', 'telemetry.retention_days', ...
  value      TEXT NOT NULL,      -- JSON serializado, validado con zod por clave
  updated_at INTEGER NOT NULL
);
```

Clave-valor con JSON validado por esquema zod por clave. Configuración de polling/retención que consume Python viaja por RPC como parámetro — Python nunca lee `app.db`.

### 3.3 Dominio: catálogo de medidores

Acá vive la solución a la heterogeneidad: el **mapa de registros por modelo** es un documento JSON en `app.db`.

```sql
CREATE TABLE brands (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE meter_models (
  id           INTEGER PRIMARY KEY,
  brand_id     INTEGER NOT NULL REFERENCES brands(id),
  name         TEXT    NOT NULL,
  register_map TEXT    NOT NULL,   -- JSON: mapa de registros (ver 3.4)
  notes        TEXT,
  UNIQUE (brand_id, name)
);

CREATE TABLE devices (
  id                 INTEGER PRIMARY KEY,
  model_id           INTEGER NOT NULL REFERENCES meter_models(id),
  name               TEXT    NOT NULL UNIQUE,   -- nombre visible ('Medidor planta 1')
  transport          TEXT    NOT NULL,          -- 'serial' | 'tcp' | 'simulated' | 'csv'
  connection         TEXT    NOT NULL,          -- JSON según transporte (ver abajo)
  slave_id           INTEGER NOT NULL DEFAULT 1,
  polling_interval_s INTEGER NOT NULL DEFAULT 900,
  enabled            INTEGER NOT NULL DEFAULT 1,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
```

`connection` por transporte (discriminated union en zod):

- `serial`: `{ "vid": "...", "pid": "...", "serialNumber": "...", "baudrate": 9600, "parity": "N", "timeoutMs": 2000 }` — VID/PID + serie, nunca `COM3` a secas (ARCHITECTURE.md §7).
- `tcp`: `{ "host": "...", "port": 502, "timeoutMs": 2000 }`
- `simulated`: `{}` (o parámetros del generador: ruido, deriva).
- `csv`: `{}` — el medidor no tiene conexión viva; sus lecturas llegan por importación de archivos (`readings.source = 'csv_import'`). El scheduler NUNCA pollea este transporte. El mapa de registros del modelo sigue siendo obligatorio: declara las métricas canónicas que el importador CSV mapea desde las columnas del archivo.

### 3.4 Contrato del mapa de registros (JSON)

Definido como tipo en `packages/shared-types` + esquema zod en core + validación espejo en Python (pydantic). Un mapa inválido explota al **guardarse**, nunca durante el polling.

```json
{
  "version": 1,
  "registers": [
    {
      "address": 3059,
      "function": "holding",
      "metric": "voltage_l1",
      "datatype": "float32",
      "wordOrder": "big_endian",
      "scale": 1.0,
      "unit": "V"
    }
  ]
}
```

- `metric` es el **nombre canónico**: el mismo string que termina en `readings.metric` de `telemetry.db`. Es el puente entre el mundo por-marca y el mundo uniforme.
- `datatype`: `int16 | uint16 | int32 | uint32 | int64 | float32 | float64`.
- `function`: `holding | input`.
- `version` permite evolucionar el contrato sin romper mapas guardados.
- Python recibe el mapa por RPC al configurar el polling de un dispositivo (`device.watch` / configuración del scheduler) — nunca leyendo `app.db`.

## 4. Diseño `telemetry.db` — datos masivos

Confirma y refina el esquema ya definido en ARCHITECTURE.md §6:

```sql
CREATE TABLE readings (
  device_id  INTEGER NOT NULL,
  metric     TEXT    NOT NULL,   -- nombre canónico (del mapa de registros)
  timestamp  INTEGER NOT NULL,   -- epoch ms
  value      REAL    NOT NULL,
  source     TEXT    NOT NULL,   -- 'polling' | 'csv_import' | 'simulated'
  UNIQUE (device_id, metric, timestamp)
) STRICT;
CREATE INDEX idx_readings_dev_ts ON readings (device_id, timestamp);

-- Agregados (downsampling, job nocturno en Python)
CREATE TABLE readings_1m (
  device_id INTEGER NOT NULL,
  metric    TEXT    NOT NULL,
  bucket    INTEGER NOT NULL,    -- inicio del minuto, epoch ms
  min       REAL NOT NULL, max REAL NOT NULL, avg REAL NOT NULL,
  count     INTEGER NOT NULL,
  PRIMARY KEY (device_id, metric, bucket)
) STRICT;
-- readings_1h: misma forma, bucket por hora

CREATE TABLE schema_meta (
  key   TEXT PRIMARY KEY,        -- 'schema_version'
  value TEXT NOT NULL
) STRICT;
```

Reglas de operación (sin cambios respecto de ARCHITECTURE.md):

- Inserts por lote en una sola transacción (cada 1–5 s o cada N lecturas), `INSERT OR IGNORE` + UNIQUE = deduplicación.
- Sin FK hacia `app.db` (son archivos separados): `device_id` es referencia lógica; la integridad la garantiza el flujo (Python solo pollea dispositivos que core le configuró).
- Retención: crudo 30–90 días (configurable), agregados permanentes, job nocturno compacta y purga.
- El modo live NO escribe a la base — solo push a la UI.

Las migraciones de `telemetry.db` las aplica **Python al arrancar** (es el escritor); versionado en `schema_meta`.

## 5. Medidor simulado

Sin hardware, la primera "marca" del catálogo es el simulador. Sembrado por migración:

- Brand: `Simulated` → Model: `SIM-100` con un mapa de registros realista (voltaje L1–L3, corriente L1–L3, potencia activa, energía acumulada — 8 métricas).
- Device: `Simulador de pruebas`, transport `simulated`.
- En Python, el simulador es un **adaptador más** que implementa el mismo puerto que el lector Modbus real (`ModbusReader` Protocol): genera valores plausibles (seno + ruido, energía monotónica creciente) respetando el mapa de registros.

Qué valida esto de punta a punta: interpretación del mapa JSON → normalización a métricas canónicas → batch writer a `telemetry.db` → agregación → consulta de histórico desde core — todo el pipeline real, sin puerto serial.

## 6. Plan de implementación (fases)

Cada fase es un PR razonable; el orden respeta dependencias.

### Fase 0 — Infraestructura de persistencia en core *(el bloqueo diferido)*

- Rebuild de `better-sqlite3` contra el ABI de Electron (`electron-rebuild` o `@electron/rebuild`; registrar el build script en `pnpm-workspace.yaml → allowBuilds`).
- `drizzle-orm` + `drizzle-kit` en `packages/core`; carpeta `database/` con migraciones de `app.db`.
- Apertura de `app.db` en WAL + `busy_timeout`; ruta vía `app.getPath('userData')` inyectada desde Electron (core es librería, no decide rutas).
- Puerto de persistencia en el dominio de core; Drizzle queda en adaptadores (`docs/HEXAGONAL.md`).

### Fase 1 — Auth: usuarios, roles, permisos, login

- Migración con tablas §3.1 + seed (roles del sistema, permisos, admin inicial).
- Hexagonal en core: dominio (`User`, `Role`, política de contraseñas) + puertos (`UserRepository`, `PasswordHasher`) + casos de uso (`login`, `createUser`, `changePassword`, `assignRole`) + adaptadores (Drizzle, argon2).
- Métodos RPC/IPC según skill `add-rpc-method`; canal IPC `auth.*` con validación zod.
- UI mínima de login (isla Vue) — puede ser PR separado.

### Fase 2 — Catálogo de medidores

- Migración con tablas §3.3 + tipos del mapa de registros en `shared-types` + zod.
- Casos de uso: CRUD de marcas/modelos/dispositivos, validación del mapa al guardar.
- Seed del medidor simulado (§5).

### Fase 3 — `telemetry.db` en Python

- Módulo de migraciones en `apps/python-service` (aplica al arranque, `schema_meta`).
- `SqliteTelemetryWriter` real (batch, transacción única, `INSERT OR IGNORE`).
- Validación pydantic del mapa de registros (espejo del zod).

### Fase 4 — Simulador end-to-end

- Adaptador simulador en Python (mismo Protocol que el lector Modbus).
- Flujo completo: core manda config del dispositivo simulado por RPC → Python pollea al simulador → batch a `telemetry.db` → consulta de histórico desde core.
- Test de integración sobre el sidecar real (patrón existente en `packages/core`).

## 7. Decisiones abiertas

| # | Decisión | Recomendación |
|---|---|---|
| 1 | Hashing de contraseñas: `argon2` (nativo, requiere rebuild como better-sqlite3) vs `bcryptjs` (JS puro, sin rebuild) | `argon2` — ya vamos a tener pipeline de rebuild por better-sqlite3; es el estándar actual |
| 2 | Roles y permisos iniciales (¿qué puede hacer un `operator` vs un `viewer`?) | Definir con el usuario antes de la Fase 1 |
| 3 | Set exacto de métricas canónicas iniciales (nombres de `metric`) | Definir junto con el mapa del simulador en Fase 2 |
| 4 | ¿Migraciones de `telemetry.db` en `database/` compartida o dentro de `apps/python-service`? | Dentro del python-service — el escritor es dueño de su esquema |
