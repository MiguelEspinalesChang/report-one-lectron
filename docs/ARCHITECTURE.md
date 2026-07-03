# Arquitectura del Monorepo — Revisión 2

**Proyecto:** Plataforma de escritorio para gestión, adquisición de datos Modbus y reportería
**Versión:** 2.0 — Python como núcleo de datos de la aplicación
**Reemplaza a:** Revisión 1 (arquitectura con API HTTP interna)

---

## 1. Objetivo

Centralizar todo el ecosistema de la aplicación en un único repositorio Git (monorepo), permitiendo desarrollar, ejecutar, compilar y distribuir todos los servicios desde un solo proyecto con un único comando.

La aplicación es 100% de escritorio (offline-first). Su función principal es la **adquisición, almacenamiento y reportería de datos de dispositivos industriales vía Modbus** (RTU serial, sondas infrarrojas-USB y TCP/Ethernet), con capacidad de procesar millones de registros por dispositivo.

### Cambios clave respecto a la Revisión 1

| Revisión 1 | Revisión 2 | Motivo |
|---|---|---|
| API HTTP interna (Node/Express en localhost) | **Sin servidor HTTP.** Lógica de negocio en `packages/core` (librería TS) expuesta vía IPC de Electron | Un puerto abierto en localhost es accesible a cualquier proceso de la máquina; requiere autenticación interna, gestión de puertos y procesos extra sin aportar valor en escritorio |
| Python como servicio auxiliar (OCR/ML/reportes) | **Python como núcleo de datos**: adquisición Modbus, ingesta masiva, importación CSV, downsampling y generación de reportes | El volumen (millones de registros) y el dominio (pymodbus, pandas) hacen de Python el dueño natural del pipeline de datos |
| Node como único punto de acceso a la base de datos | **Propiedad dividida por dominio**: Python escribe telemetría; Node es dueño del negocio | Los datos masivos se escriben donde nacen; pasarlos por stdio→IPC→JSON saturaría CPU |
| Flujo únicamente request/response | Request/response **+ canal de eventos push** (lecturas live, alarmas, estado, progreso de jobs) | Los dispositivos generan flujo continuo de eventos, no solo respuestas |

---

## 2. Stack tecnológico

| Capa | Tecnología | Rol |
|---|---|---|
| Shell de escritorio | **Electron** | Ventana, ciclo de vida, procesos, actualizaciones, puente IPC |
| Frontend | **Vue 3 + TypeScript** (arquitectura de islas) | Exclusivamente interfaz de usuario |
| Núcleo de negocio | **packages/core** — TypeScript puro (librería, no servidor) | Servicios de negocio, validación, orquestación, consultas de histórico |
| Núcleo de datos | **Python 3.11+** (proceso sidecar persistente) | Adquisición Modbus, ingesta, CSV, downsampling, reportes PDF/Excel |
| Base de datos | **SQLite** (modo WAL), dos archivos: `app.db` y `telemetry.db` | Negocio y telemetría separados |
| Tooling monorepo | **pnpm workspaces + Turborepo** | Build, dev, cache, pipelines |

---

## 3. Estructura del monorepo

```
desktop-platform/
├── apps/
│   ├── electron/                 # Shell: main process, preload, handlers IPC delgados
│   │   ├── main/
│   │   │   ├── window.ts
│   │   │   ├── handlers.ts       # ipcMain.handle → delega a packages/core
│   │   │   ├── events.ts         # webContents.send (push hacia Vue)
│   │   │   └── python-manager.ts # spawn/supervisión del sidecar Python
│   │   └── preload/
│   │       └── bridge.ts         # contextBridge: API tipada expuesta a Vue
│   │
│   ├── frontend/                 # Vue 3 + TS — solo UI
│   │   └── islands/
│   │       ├── Dashboard/
│   │       ├── Devices/          # estado en vivo, vista live por dispositivo
│   │       ├── Inventory/
│   │       ├── Reports/
│   │       ├── Imports/          # subida de CSV con progreso
│   │       ├── Settings/
│   │       └── Users/
│   │
│   └── python-service/           # Núcleo de datos (sidecar persistente)
│       ├── acquisition/
│       │   ├── transports/       # RTU serial, TCP, resolución de puertos por VID/PID+serial
│       │   ├── scheduler/        # polling base + modo live, cola de prioridad por bus
│       │   └── profiles/         # perfiles por modelo de dispositivo (config, no código)
│       ├── storage/
│       │   ├── writer.py         # batch inserts a telemetry.db
│       │   ├── downsampling.py   # agregados por minuto/hora
│       │   └── retention.py      # purga/archivado de datos crudos
│       ├── imports/
│       │   └── csv_parsers/      # un parser por perfil de fabricante
│       ├── reports/              # plantillas parametrizables → PDF/Excel
│       └── rpc/                  # JSON-RPC bidireccional sobre stdio
│
├── packages/
│   ├── core/                     # ★ Lógica de negocio (librería TS pura, sin HTTP)
│   │   ├── services/             # InventoryService, UserService, DeviceService...
│   │   ├── repositories/         # acceso a app.db (Drizzle + better-sqlite3)
│   │   ├── telemetry/            # consultas de histórico con agregación (lee telemetry.db)
│   │   ├── devices/              # config de dispositivos, espejo de estado en vivo
│   │   ├── python-bridge/        # cliente RPC stdio: comandos ↓ / eventos ↑
│   │   └── validators/
│   ├── shared-types/             # DTOs, tipos de eventos IPC, esquemas
│   ├── shared-utils/
│   ├── ui-components/
│   ├── config/
│   ├── eslint-config/
│   └── tsconfig/
│
├── database/                     # migraciones (app.db y telemetry.db)
├── scripts/
├── installer/                    # electron-builder + empaquetado PyInstaller
└── docs/
```

---

## 4. Responsabilidades por capa

### Electron (shell)
- Ventana principal, ciclo de vida, actualizaciones.
- Arranca y supervisa el sidecar Python (reinicio ante crash, apagado limpio).
- Expone `packages/core` a Vue mediante handlers IPC **delgados** (una línea que delega).
- Reenvía eventos push del core a Vue con `webContents.send`.
- **No contiene lógica de negocio.** Solo la expone.

### Vue (frontend)
- Exclusivamente interfaz de usuario: invoca, escucha eventos y pinta.
- **Regla del proyecto:** ninguna decisión de negocio vive en Vue. Ni agregaciones, ni validación de CSV, ni lógica de dispositivos. Si hay tentación de "procesar tantito" en el frontend, ese código pertenece a core o a Python.

### packages/core (núcleo de negocio — TypeScript)
- Servicios de negocio: usuarios, inventario, configuración, seguridad, validaciones.
- Dueño exclusivo de `app.db`.
- Consultas de histórico sobre `telemetry.db` (solo lectura, con agregación SQL).
- Cliente del sidecar Python (comandos y suscripción a eventos).
- Es una **librería**, no un servidor: no abre puertos. Si el proyecto migra a web/SaaS, el mismo paquete se monta dentro de Fastify/Express sin reescribir lógica.

### Python (núcleo de datos)
- Adquisición Modbus RTU y TCP (dueño exclusivo de puertos seriales).
- Escritura masiva de telemetría en lotes a `telemetry.db`.
- Importación y normalización de CSV de dispositivos.
- Downsampling, retención y jobs nocturnos.
- Generación de reportes PDF/Excel.
- OCR / ML / automatización (roles heredados de la Revisión 1).
- **Nunca es consumido directamente por Vue.**

---

## 5. Comunicación entre procesos

```
┌──────────┐  ipcRenderer.invoke   ┌──────────────┐   llamada directa   ┌───────────────┐
│   Vue    │ ───────────────────▶  │ Electron main │ ─────────────────▶ │ packages/core │
│(renderer)│ ◀─────────────────── │  (handlers)   │ ◀───────────────── │  (servicios)  │
└──────────┘  webContents.send     └──────────────┘                     └───────┬───────┘
    ▲              (eventos push)                                               │ JSON-RPC
    │                                                                           │ sobre stdio
    │                                                                   ┌───────▼───────┐
    │                              eventos ligeros (estado/alarmas/live)│ Python sidecar │
    └───────────────────────────────────────────────────────────────── │  (persistente) │
                                                                        └───────┬───────┘
                                                                                │ batch writes
                                                                        ┌───────▼───────┐
                                                                        │ telemetry.db  │
                                                                        └───────────────┘
```

### Protocolos
1. **Vue ↔ Electron:** IPC nativo. Comandos con `ipcRenderer.invoke` / `ipcMain.handle`; flujo push con `webContents.send` + listeners expuestos en el preload (`onDeviceReading(cb)`, `onImportProgress(cb)`...). `contextIsolation: true`, `nodeIntegration: false`; solo la API del `contextBridge` es visible al renderer.
2. **Core ↔ Python:** **JSON-RPC 2.0 bidireccional sobre stdin/stdout.** Node envía comandos (`device.watch`, `import.csv`, `report.generate`); Python responde y además **emite notificaciones no solicitadas** (`device.reading`, `device.status`, `import.progress`, `alarm.raised`). Sin HTTP, sin puertos.
3. **Python ↔ dispositivos:** Modbus RTU (serial/infrarrojo-USB) y Modbus TCP (Ethernet) con `pymodbus` 3.x async.

### Regla de tráfico de datos
> **Los datos calientes viajan, los datos masivos se escriben donde nacen.**

- Lecturas masivas de polling → Python las escribe **directo** a `telemetry.db`. No cruzan stdio ni IPC.
- Hacia arriba solo viajan **resúmenes**: último valor por dispositivo, cambios de estado, alarmas, progreso de jobs.
- El histórico se consulta bajo demanda: Vue → IPC → core → SQL con agregación → miles de puntos, nunca millones.

---

## 6. Base de datos

Dos archivos SQLite, ambos en **modo WAL** con `busy_timeout` configurado en todos los procesos.

### `app.db` — dueño: packages/core (Node)
Usuarios, inventario, configuración, perfiles de dispositivos, definiciones de reportes, permisos.

### `telemetry.db` — escritor: Python / lector: core
```sql
CREATE TABLE readings (
  device_id   INTEGER NOT NULL,
  metric      TEXT    NOT NULL,      -- registro/variable Modbus normalizada
  timestamp   INTEGER NOT NULL,      -- epoch ms
  value       REAL    NOT NULL,
  source      TEXT    NOT NULL,      -- 'polling' | 'csv_import'
  UNIQUE (device_id, metric, timestamp)
);
CREATE INDEX idx_readings_dev_ts ON readings (device_id, timestamp);
```
- Inserts por lote en una sola transacción (cada 1–5 s o cada N lecturas).
- `INSERT OR IGNORE` + constraint UNIQUE = deduplicación automática (CSV repetidos o traslapados con polling).
- Tablas de agregados: `readings_1m`, `readings_1h` (downsampling).

### Retención
- Datos crudos: 30–90 días (configurable).
- Agregados por minuto/hora: permanentes.
- Job nocturno en Python compacta y purga.

**Ventajas de separar los archivos:** backup del negocio liviano, purga de telemetría sin tocar `app.db`, y cada proceso es dueño indiscutible de su archivo de escritura.

---

## 7. Adquisición Modbus

### Transportes soportados
| Transporte | Protocolo | Consideraciones |
|---|---|---|
| Convertidor infrarrojo → USB (sonda óptica) | Modbus RTU serial | Baudrates bajos (300–9600), sensible a alineación/luz; esperar timeouts y reintentos frecuentes |
| USB directo (RS-485/RS-232) | Modbus RTU serial | Cada puerto es un bus independiente con su propia cola |
| Ethernet | Modbus TCP | Reconexión con backoff exponencial; fallos de red distintos a fallos seriales |

### Reglas de adquisición
- **Un solo dueño del puerto serial:** únicamente el proceso Python abre los puertos. Si una segunda instancia de la app intenta abrirlos, el error se maneja con mensaje claro al usuario.
- **Identificación estable de puertos:** la configuración guarda VID/PID + número de serie del convertidor, nunca `COM3`/`/dev/ttyUSB0` a secas; el puerto se resuelve al arranque.
- **Máquina de estados por dispositivo:** `connected / degraded / disconnected`, reportada a la UI vía eventos.
- **Un dispositivo lento no bloquea a los demás:** asyncio + cola de prioridad **por bus**. Dispositivos en buses distintos se pollean en paralelo; dispositivos en el mismo bus se serializan.
- **Auto-medición:** Python registra la duración de cada transacción Modbus por dispositivo para calibrar empíricamente la frecuencia live que cada equipo soporta.
- Capacidad objetivo: **4–9 dispositivos simultáneos.**

### Scheduler: dos modos coexistentes

```
Modo base:  cada 15 min → lectura completa → batch a telemetry.db
Modo live:  vista de dispositivo abierta → polling rápido (1–5 s) SOLO de ese
            dispositivo y SOLO de los registros visibles → push directo a Vue
```

- Vue emite `device:watch(deviceId)` al abrir la vista y `device:unwatch` al salir.
- **El modo live NO escribe a la base de datos**: son datos efímeros de pantalla; el histórico oficial sigue siendo el polling de 15 min.
- **Heartbeat con timeout:** si el frontend muere sin hacer unwatch, Python cancela el live tras X minutos sin señal. Nunca queda un polling rápido huérfano en un bus serial.
- Prioridad: lecturas live > polling base del mismo bus (la lectura base espera unos segundos).
- Frecuencias, baudrate, timeouts y set de registros: **configurables por perfil de dispositivo** (tabla en `app.db`), no hardcodeados. La velocidad real de cada modelo se calibrará con hardware en mano.

---

## 8. Importación de CSV

Los dispositivos exportan reportes CSV con formatos heterogéneos por fabricante. El CSV es **otra fuente de ingesta hacia la misma tabla de telemetría**, no un mundo aparte.

```
Usuario sube CSV (Vue) → IPC → core → Python:
  1. parseo con el parser del perfil del dispositivo
  2. normalización a (device_id, timestamp, metric, value, source='csv_import')
  3. batch insert con INSERT OR IGNORE
  4. resumen: "12,400 insertadas, 300 duplicadas ignoradas, 5 filas inválidas"
```

- **Un parser por perfil de fabricante** (separadores, formatos de fecha, unidades, nombres de columna).
- **Job asíncrono:** la importación nunca bloquea el IPC. Core lanza el job; Python reporta `import.progress` por eventos; Vue muestra barra de progreso.
- La columna `source` permite auditar el origen de cualquier dato en un reporte.

---

## 9. Reportes

- Los reportes son **consultas sobre `telemetry.db`** — indistinto si el dato vino de polling o de CSV.
- Consultas interactivas (gráficas en Vue): core → SQL con agregación (`AVG`/`MAX`/`MIN` por hora) → IPC. Sin pasar por Python.
- Reportes generados (PDF/Excel para el cliente): Python (pandas + openpyxl/reportlab).
- **Plantillas parametrizables** — rango de fechas, dispositivos, métricas, agrupación — en lugar de reportes hardcodeados. Ejemplo: "24 h del día X del dispositivo Y" es solo una parametrización, no un reporte especial.

---

## 10. Librerías

### Node / TypeScript
| Librería | Uso |
|---|---|
| `electron` | Shell de escritorio |
| `electron-builder` | Empaquetado e instaladores |
| `better-sqlite3` | Acceso síncrono y rápido a SQLite desde core |
| `drizzle-orm` | ORM tipado sobre better-sqlite3 (`app.db`) |
| `vue` 3 + `pinia` + `vue-router` | Frontend (stores suscritas a eventos push) |
| `zod` | Validación de DTOs en fronteras IPC |
| `vite` | Bundler del frontend |
| `turbo` + `pnpm` | Monorepo |
| `vitest` | Tests unitarios TS |

### Python
| Librería | Uso |
|---|---|
| `pymodbus` 3.x (async) | Modbus RTU y TCP |
| `pyserial` / `pyserial-asyncio` | Capa serial, enumeración de puertos (VID/PID/serial) |
| `aiosqlite` o `sqlite3` + executor | Escritura por lotes a `telemetry.db` |
| `pandas` | Parseo/normalización de CSV, preparación de reportes |
| `openpyxl` | Reportes Excel |
| `reportlab` | Reportes PDF |
| `pydantic` | Validación de mensajes RPC y perfiles de dispositivo |
| `pytest` | Tests |
| `PyInstaller` | Empaquetado del runtime Python para el instalador |

---

## 11. Reglas de arquitectura del proyecto

1. **Electron no contiene lógica de negocio.** Sus handlers IPC son delegaciones de una línea a `packages/core`.
2. **Vue solo invoca, escucha y pinta.** Cero decisiones de negocio en el frontend.
3. **`packages/core` es una librería, no un servidor.** Prohibido abrir puertos HTTP en la app de escritorio. (La migración futura a web consiste en montar core dentro de un framework HTTP, no en reescribirlo.)
4. **Python es el único proceso que toca puertos seriales** y el único escritor de `telemetry.db`.
5. **Node/core es el único escritor de `app.db`.**
6. **Los datos masivos no cruzan fronteras de proceso.** Solo viajan resúmenes, estados, alarmas y resultados de consultas agregadas.
7. **Todo componente reutilizable vive en `packages/`** (tipos, utils, UI).
8. **Perfiles configurables, no código hardcodeado**, para: parámetros Modbus por modelo, parsers CSV por fabricante y plantillas de reportes.
9. **Toda frontera valida:** zod en IPC (TS), pydantic en RPC (Python).
10. **Contratos compartidos:** los tipos de mensajes IPC/RPC viven en `shared-types` y son la única fuente de verdad.

---

## 12. Desarrollo, compilación e instalación

### Desarrollo
```bash
pnpm dev
```
Inicia automáticamente: Electron, Vue (HMR), watchers de core y el sidecar Python. No se inicia ningún proyecto manualmente.

### Compilación
```bash
pnpm build
```
Compila Vue, core, empaqueta Python (PyInstaller) y Electron.

### Instalador
```bash
pnpm installer
```
- **Windows:** `Setup.exe`
- **Linux:** `AppImage` o `.deb`
- Incluye el runtime de Python con `pymodbus` y drivers seriales empaquetado con PyInstaller. *Definir y probar este empaquetado temprano: es la parte más dolorosa de la distribución.*

### Scripts
| Comando | Acción |
|---|---|
| `pnpm dev` | Inicia toda la plataforma |
| `pnpm build` | Compila todos los proyectos |
| `pnpm lint` | ESLint (TS) + ruff (Python) sobre todo el monorepo |
| `pnpm test` | vitest + pytest |
| `pnpm clean` | Limpia artefactos temporales |
| `pnpm installer` | Genera el instalador |
| `pnpm update` | Actualiza dependencias |

---

## 13. Git

Repositorio único con flujo de ramas:

```
main
develop
feature/*     (feature/devices-modbus, feature/csv-import, feature/reports...)
release/*
hotfix/*
```

- Toda funcionalidad se desarrolla en rama `feature/*`.
- Prohibido desarrollar directamente sobre `main` o `develop`.

---

## 14. Flujo general del sistema

```
Dispositivos Modbus (RTU / IR-USB / TCP)
        │  pymodbus (asyncio, cola por bus)
        ▼
Python sidecar ──batch──▶ telemetry.db ◀──lectura agregada── packages/core
        │                                                        ▲
        │ eventos ligeros (JSON-RPC stdio):                      │ app.db (negocio)
        │ estado, alarmas, último valor, progreso                │
        ▼                                                        │
packages/core ◀────────── comandos ──────────────────────────────┘
        ▲
        │ IPC (invoke / webContents.send)
        ▼
Electron main ◀──▶ Vue (islas) ◀──▶ Usuario
```

---

## 15. Pendientes por definir

- Velocidad real de lectura por modelo de dispositivo → calibrar con hardware y la auto-medición del scheduler.
- CSV de ejemplo de cada fabricante → definir los parsers concretos y validar que el esquema `(device_id, timestamp, metric, value)` cubre todos los formatos.
- Política exacta de retención de datos crudos (30 vs 90 días) según requisitos del cliente.
- Estrategia de actualizaciones automáticas de Electron (electron-updater) y su interacción con el sidecar empaquetado.
