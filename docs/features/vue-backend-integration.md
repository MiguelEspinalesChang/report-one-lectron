# Feature: Integración Vue ↔ backend — catálogo, mapas y lectura de datos

> Estado: **EN CURSO — la UI puede arrancar con el catálogo hoy; telemetría/adquisición requieren cableado IPC previo**
> Documentos normativos: `docs/ARCHITECTURE.md` §11, `docs/PYTHON-DB.md`
> Antecedentes: `db-architecture-done.md` (plan de DB) y `db-architecture-progress-done.md` (implementación)

Qué cubre: lo que el backend **espera recibir** desde Vue para gestionar marcas, mapas de registros y dispositivos, cómo llega la data (Modbus o import CSV), y qué falta cablear antes de que la UI pueda leer telemetría.

## 1. Cómo conecta Vue (la única puerta)

Vue **nunca** importa Node ni Electron. Todo pasa por `window.platform`, el objeto `PlatformApi` que inyecta el preload (`apps/electron/preload/bridge.ts`). Dos patrones, nada más:

```
Request/response:  await window.platform.catalog.brands.create({ name: 'Schneider' })
Push (suscripción): const off = window.platform.devices.onReading((r) => { ... }); off() al desmontar
```

- El contrato completo vive en `PlatformApi` (`packages/shared-types/src/index.ts`) — la UI programa contra esa interfaz, sin casts.
- Cada handler de Electron valida el payload con zod ANTES de tocar core. Un payload inválido rechaza la promesa; la UI nunca ve estado corrupto.
- Regla de propiedad (ARCHITECTURE.md §11): Vue solo **invoca, escucha y pinta**. Cero lógica de negocio en el renderer — si un flujo necesita decidir algo, eso vive en core.

## 2. Superficie disponible HOY

| Área | Métodos de `window.platform` | Estado |
|---|---|---|
| Marcas | `catalog.brands` — `create` / `list` / `rename` / `delete` | ✅ listo |
| Modelos + mapa | `catalog.models` — `create` / `list` / `listByBrand` / `updateMap` / `delete` | ✅ listo |
| Dispositivos | `catalog.devices` — `create` / `list` / `update` / `enable` / `delete` | ✅ listo |
| Auth | `auth` — `login` / `logout` / `getSession` / `changePassword` | ✅ listo |
| Usuarios | `users` — `create` / `list` / `assignRole` | ✅ listo |
| Live (push) | `devices.watch` / `unwatch` / `onReading` / `onStatus` | ⚠️ funciona, pero emite valores placeholder |
| Histórico de telemetría | — | 🔴 sin canal IPC (ver §5) |
| Disparo de adquisición / import CSV | — | 🔴 sin canal IPC (ver §5) |

## 3. Qué espera el backend en cada flujo

### 3.1 Alta de marca

```ts
const brand = await window.platform.catalog.brands.create({ name: 'Schneider' })
```

`name`: string 1–128, único (case-sensitive a nivel DB). Duplicado → promesa rechazada.

### 3.2 Alta de modelo con su mapa de registros

```ts
const model = await window.platform.catalog.models.create({
  brandId: brand.id,
  name: 'PM5560',
  registerMap: { version: 1, registers: [ /* ver contrato */ ] },
  notes: null,
})
```

El `registerMap` es EL contrato central — la UI necesita un editor que produzca exactamente esto:

| Campo de cada register | Regla |
|---|---|
| `address` | entero 0–65535 |
| `function` | `'holding'` \| `'input'` |
| `metric` | string no vacío, **único dentro del mapa** — es el nombre canónico que termina en `readings.metric` |
| `datatype` | `'int16'` \| `'uint16'` \| `'int32'` \| `'uint32'` \| `'int64'` \| `'float32'` \| `'float64'` |
| `wordOrder` | `'big_endian'` \| `'little_endian'` |
| `scale` | number (default 1) |
| `unit` | string (puede ser `''`) |

Nivel mapa: `version` exactamente `1`, `registers` con al menos 1 entrada, métricas sin duplicar. Un mapa inválido **rechaza al guardar** (zod en la frontera + validador de dominio en core) — nunca falla después, durante la lectura. Para editar el mapa de un modelo existente: `catalog.models.updateMap({ id, registerMap })`.

### 3.3 Alta de dispositivo — acá entra el caso CSV

```ts
const device = await window.platform.catalog.devices.create({
  modelId: model.id,
  name: 'Medidor planta 1',   // único
  transport: 'csv',
  connection: {},
  slaveId: 1,                  // 0–247
  pollingIntervalS: 900,
  enabled: true,
})
```

`connection` depende del `transport` (unión discriminada — si no matchea, rechaza):

| `transport` | `connection` esperado | Caso de uso |
|---|---|---|
| `'serial'` | `{ vid, pid, serialNumber?, baudrate, parity: 'N'\|'E'\|'O', timeoutMs }` | Modbus RTU — identificar por VID/PID+serie, nunca `COM3` |
| `'tcp'` | `{ host, port 1–65535, timeoutMs }` | Modbus TCP |
| `'simulated'` | `{}` | Desarrollo sin hardware |
| `'csv'` | `{}` | **Medidor sin conexión viva: su data llega SOLO por importación de CSV** |
| Ojo | `slaveId` y `pollingIntervalS` son irrelevantes para `csv` — mandar los defaults | |

La UI debería condicionar el formulario de conexión según el transporte elegido, y para `csv` no pedir parámetros de conexión ni de polling.

### 3.4 Lectura de datos — los dos caminos

Ambos caminos terminan en el MISMO lugar (`telemetry.db → readings`) con las MISMAS métricas canónicas del mapa. La UI de visualización no distingue el origen; solo cambia `readings.source`.

- **Modbus (`serial`/`tcp`/`simulated`)**: Python pollea según el mapa y escribe batches (`source='polling'`/`'simulated'`). El modo live (`devices.watch` → `onReading`) empuja valores a la UI sin tocar la DB.
- **Import CSV (`csv`, o cualquier medidor con archivos exportados)**: el importador (fase pendiente) parsea el archivo, mapea columnas → métricas canónicas del modelo y escribe con `source='csv_import'`. Re-importar el mismo archivo NO duplica (dedup por `UNIQUE(device_id, metric, timestamp)` + `INSERT OR IGNORE`).

## 4. Errores e i18n

- Todo error llega como **promesa rechazada** de `ipcRenderer.invoke`; el `message` viene del error de dominio (ej. mapa inválido, conexión que no matchea el transporte, nombre duplicado).
- La UI mapea errores a mensajes traducidos — TODO texto visible pasa por `t('...')` y se agrega en `en.json` Y `es.json` (convención del frontend).
- Sesión: `auth.getSession()` al montar; si `mustChangePassword` es `true`, forzar el flujo de cambio antes de cualquier otra pantalla.

## 5. Lo que falta cablear ANTES de que la UI lea telemetría

El backend de core ya tiene los servicios; falta exponerlos al renderer. Seguir `.claude/skills/add-rpc-method/SKILL.md` (toca ~5 archivos en 3 procesos):

| Gap | Qué agregar | Servicio de core (ya existe) |
|---|---|---|
| Histórico | Canal `telemetry:getHistory` + `PlatformApi.telemetry.getHistory(params)` | `TelemetryService.getHistory` — params `TelemetryHistoryParams`, retorna `TelemetryPoint[]` (min/max/avg/count por bucket) |
| Poll simulado | Canal `acquisition:simulatedPoll` + superficie en `PlatformApi` | `AcquisitionService.runSimulatedPoll` — retorna `SimulatedPollResult` |
| Import CSV | RPC nuevo en Python (parser + mapping columna→métrica) + canal IPC + UI de import | — (fase importador; python escribe con `source='csv_import'`) |
| Live real | Reemplazar el placeholder de `device.watch` por el `SimulatedReader` / lector Modbus | — |
| Scheduler | Polling periódico por `polling_interval_s`; **saltear transporte `csv`** | — |

Los tipos de todos estos contratos (`TelemetryHistoryParams`, `TelemetryPoint`, `SimulatedPollParams`, `SimulatedPollResult`) ya están definidos en `shared-types` — el cableado no inventa contratos, solo los expone.

## 6. Checklist para arrancar la UI

- [ ] Pantalla de catálogo puede construirse HOY completa (marcas → modelos con editor de mapa → dispositivos con formulario por transporte).
- [ ] El editor de mapa valida en el cliente las mismas reglas de §3.2 (mejor UX), pero la verdad la dicta el backend al guardar.
- [ ] Formulario de dispositivo condicionado por transporte; `csv` sin campos de conexión/polling.
- [ ] Vistas de telemetría: diseñarlas contra `TelemetryPoint[]`, pero bloqueadas hasta cablear §5.
- [ ] Toda string visible por `t('...')` en EN y ES.
