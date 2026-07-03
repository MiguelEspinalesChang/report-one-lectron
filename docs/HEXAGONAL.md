# Arquitectura Hexagonal — Guía de aplicación

**Complementa a:** `docs/ARCHITECTURE.md` (que define QUÉ hace cada proceso). Esta guía define CÓMO se organiza el código dentro de cada proceso.

---

## 1. El concepto en un minuto

Hexagonal (puertos y adaptadores) es UNA sola regla con tres piezas:

- **Dominio**: las reglas de negocio puras. No importa nada de infraestructura (ni sqlite, ni electron, ni pymodbus). Solo tipos y lógica.
- **Puertos**: interfaces que el dominio declara para hablar con el mundo ("necesito algo que guarde lecturas", "necesito algo que lea registros Modbus"). El dominio define el contrato; no le importa quién lo cumple.
- **Adaptadores**: implementaciones concretas de los puertos (sqlite, pymodbus, el bridge RPC) y puntos de entrada (handlers IPC, servidor RPC).

**La regla de dependencia — la única que importa:**

> Las dependencias apuntan SIEMPRE hacia adentro. El dominio no conoce a los adaptadores. Los adaptadores conocen a los puertos. Nadie del centro importa nada del borde.

Si un archivo de dominio importa `better-sqlite3`, `electron`, `pymodbus` o `pandas` — se rompió el hexágono. No hay excepciones.

**Por qué nos importa acá:** el documento de arquitectura ya promete que `packages/core` migra a web/SaaS "montándolo en Fastify sin reescribir lógica". Eso SOLO es cierto si el dominio no sabe que existe Electron. Hexagonal es el mecanismo que cumple esa promesa.

---

## 2. El hexágono mapeado a este monorepo

```
        ADAPTADORES DE ENTRADA (driving)          ADAPTADORES DE SALIDA (driven)
        ─ quién invoca al dominio ─               ─ a quién invoca el dominio ─

   Electron ipcMain.handle ──┐                ┌── SqliteXRepository (app.db, drizzle)
   (apps/electron/main)      │   packages/    │
                             ├──▶   core   ───┤── PythonDataCoreGateway
   [futuro: rutas Fastify] ──┘   (hexágono TS)│   (python-bridge → sidecar)
                                              └── TelemetryReader (telemetry.db, solo lectura)

   rpc/server.py ────────────┐                ┌── SqliteTelemetryWriter (telemetry.db)
   (JSON-RPC sobre stdio)    │   python-      │
                             ├──▶  service ───┤── PymodbusTransport (RTU/TCP)
   [futuro: scheduler cron] ─┘  (hexágono Py) │
                                              └── PandasCsvParser (por fabricante)
```

Vue queda **fuera de ambos hexágonos**: es una capa de presentación cuyo único puerto es `window.platform` (implementado por el preload). Por eso la regla "Vue solo pinta" — no es estilo, es que la UI es un adaptador de entrada remoto.

---

## 3. Cómo crear un FEATURE en `packages/core`

Estructura por feature (screaming architecture: la carpeta grita el negocio, no la técnica):

```
packages/core/src/
└── inventory/                        # el feature
    ├── domain/
    │   └── item.ts                   # entidad + reglas puras
    ├── ports/
    │   └── inventory-repository.ts   # interface que el dominio necesita
    ├── application/
    │   └── inventory-service.ts      # caso de uso: orquesta dominio + puertos
    └── adapters/
        └── sqlite-inventory-repository.ts  # implementación con drizzle
```

**Paso 1 — Dominio.** Tipos y reglas. Cero imports de infraestructura:

```ts
// domain/item.ts
export interface Item {
  id: number
  name: string
  stock: number
  minimumStock: number
}

export function isBelowMinimum(item: Item): boolean {
  return item.stock < item.minimumStock
}
```

**Paso 2 — Puerto.** El dominio declara lo que necesita, en SU vocabulario:

```ts
// ports/inventory-repository.ts
import type { Item } from '../domain/item'

export interface InventoryRepository {
  findById(id: number): Promise<Item | null>
  save(item: Item): Promise<void>
  findAll(): Promise<Item[]>
}
```

**Paso 3 — Caso de uso.** Recibe puertos por constructor (inyección), nunca instancia adaptadores:

```ts
// application/inventory-service.ts
import { isBelowMinimum, type Item } from '../domain/item'
import type { InventoryRepository } from '../ports/inventory-repository'

export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  async itemsBelowMinimum(): Promise<Item[]> {
    const items = await this.repository.findAll()
    return items.filter(isBelowMinimum)
  }
}
```

**Paso 4 — Adaptador.** La única capa que conoce drizzle/sqlite:

```ts
// adapters/sqlite-inventory-repository.ts
import type { InventoryRepository } from '../ports/inventory-repository'
// import { db } from '...' — drizzle vive SOLO acá

export class SqliteInventoryRepository implements InventoryRepository {
  // implementación con drizzle sobre app.db
}
```

**Paso 5 — Cablear en `createCore()`** (`src/index.ts`): es el ÚNICO lugar donde adaptadores y casos de uso se encuentran (composition root):

```ts
const inventoryRepository = new SqliteInventoryRepository()
const inventory = new InventoryService(inventoryRepository)
```

**Paso 6 — Exponer.** Si la UI lo necesita, seguir el skill `add-rpc-method` / agregar el handler IPC. El handler de Electron sigue siendo una línea: es solo el adaptador de entrada.

**El sidecar Python visto desde core es un puerto más.** Cuando un caso de uso necesite datos del data-core, no inyectes `PythonBridge` directo: declará un puerto (`DataCoreGateway`) y hacé que un adaptador lo implemente envolviendo al bridge. Los servicios demo actuales (`SystemService`, `DeviceService`) toman el bridge directo porque son plomería de esqueleto — el primer feature real introduce el puerto.

---

## 4. Cómo crear un COMPONENTE en Vue (contenedor / presentacional)

En el frontend el hexágono se traduce al patrón **container–presentational**:

| Pieza | Dónde vive | Qué puede hacer | Qué tiene prohibido |
|---|---|---|---|
| **Isla (contenedor)** | `apps/frontend/src/islands/<Area>/` | Hablar con `window.platform`, leer/escribir stores de Pinia, decidir qué componente pintar | Contener markup complejo reutilizable |
| **Componente presentacional** | `packages/ui-components/` (o local si es de un solo uso) | Recibir `props`, emitir `emits`, pintar | Tocar `window.platform`, stores, o cualquier estado global |

```
window.platform (el puerto de la UI)
        │
   isla contenedora  ── props ──▶  componente presentacional
   (sabe DE DÓNDE     ◀── emits ──  (sabe CÓMO se ve,
    vienen los datos)                no de dónde viene nada)
```

**Regla práctica:** si un componente recibe todo por props y avisa todo por emits, es presentacional y va a `ui-components` cuando se reutilice. Si necesita saber de dónde vienen los datos, es contenedor y es una isla.

**Paso a paso:**
1. ¿El dato existe en `PlatformApi`? Si no → skill `add-rpc-method` primero.
2. Creá el presentacional: solo `props` + `emits`, tipos importados de `@platform/shared-types`.
3. Creá/extendé la isla contenedora: suscripciones, stores, y pasa props al presentacional.
4. Estado compartido entre islas → store de Pinia suscrito UNA vez a los eventos push.
5. Seguir el skill `add-island` para las reglas de ciclo de vida (unsubscribe, unwatch).

---

## 5. Cómo crear un PROCESO en Python

El mismo hexágono, con `typing.Protocol` como puertos. Ejemplo con la importación de CSV:

```
apps/python-service/
└── imports/
    ├── domain.py            # normalización pura: filas → lecturas válidas
    ├── ports.py             # Protocols: TelemetryWriter, CsvParser
    ├── csv_parsers/         # adaptadores: un parser por fabricante
    └── service.py           # caso de uso: parsear → normalizar → escribir → reportar progreso
```

**Puerto** (contrato, sin implementación):

```python
# imports/ports.py
from __future__ import annotations

from typing import Protocol


class TelemetryWriter(Protocol):
    def write_batch(self, readings: list[Reading]) -> BatchResult: ...
```

**Dominio** (función pura — testeable sin mocks):

```python
# imports/domain.py
def normalize_rows(rows: list[RawRow], device_id: int) -> tuple[list[Reading], list[RowError]]:
    """Pure: no I/O, no clock, no random. Same input, same output."""
```

**Caso de uso** (recibe puertos, orquesta):

```python
# imports/service.py
class CsvImportService:
    def __init__(self, parser: CsvParser, writer: TelemetryWriter, notify: ProgressNotifier) -> None:
        ...
```

**Adaptador de entrada:** el handler en `rpc/server.py` sigue siendo delgado — parsea params, llama al servicio, devuelve el resumen. La lógica NO vive en el handler (misma regla que los handlers de Electron).

**Adaptadores de salida:** `storage/writer.py` (sqlite), `acquisition/transports/` (pymodbus), `imports/csv_parsers/` (pandas). Son los únicos archivos que importan esas librerías.

---

## 6. Testing: el premio de todo esto

La razón práctica de hexagonal es que **el dominio se testea sin infraestructura**:

- **Dominio**: tests unitarios puros. Sin mocks, sin DB, sin puertos seriales. `isBelowMinimum(item)` y `normalize_rows(rows)` se prueban con datos en memoria.
- **Casos de uso**: tests con **fakes de puertos** (una clase de 5 líneas que implementa la interface en memoria). Nada de frameworks de mocking pesados.
- **Adaptadores**: tests de integración reales — como el que ya existe en `packages/core/src/python-bridge/client.spec.ts`, que levanta el sidecar de verdad. Los adaptadores se prueban contra la cosa real, no contra mocks.

Si para testear una regla de negocio necesitás levantar sqlite o un puerto serial, la regla está en la capa equivocada.

---

## 7. Checklist rápido (para cualquier capa)

1. ¿La regla de negocio está en `domain/` y no importa infraestructura? ✅
2. ¿El caso de uso recibe puertos por constructor y no instancia adaptadores? ✅
3. ¿El adaptador es el único que importa la librería de infraestructura? ✅
4. ¿El punto de entrada (handler IPC / handler RPC / isla) es delgado y delega? ✅
5. ¿El cableado concreto pasa solo en el composition root (`createCore()` / `main.py`)? ✅
6. ¿Podés testear el dominio con datos en memoria? ✅

## 8. Qué NO hexagonalizar (YAGNI)

- **El shell de Electron** (`window.ts`, `python-manager.ts`): es plomería de plataforma, no negocio.
- **El preload**: es literalmente un adaptador; no tiene dominio adentro.
- **`shared-types`, `config`, `shared-utils`**: son contratos y constantes, no tienen comportamiento.
- **Features de una sola función sin reglas**: si no hay decisión de negocio, no inventes puertos para un CRUD trivial — el puerto nace cuando aparece la primera regla o el segundo consumidor.

Hexagonal es una herramienta, no una religión. El costo (más archivos, indirección) se paga solo donde hay lógica de negocio que proteger.
