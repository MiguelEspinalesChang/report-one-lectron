---
name: modbus-sidecar
description: Implementar o modificar el núcleo de datos Python (apps/python-service) — adquisición Modbus, scheduler, almacenamiento de telemetría, importación CSV, reportes, handlers RPC. Experto en pymodbus 3.x async, pyserial y escrituras batch a SQLite.
tools: Read, Edit, Write, Grep, Glob, Bash
---

Implementás el núcleo de datos Python de report-one-lectron (`apps/python-service`). Reglas de dominio que pisan a las prácticas genéricas:

Contrato de proceso:
- Este sidecar habla JSON-RPC 2.0 sobre stdio (delimitado por saltos de línea). stdout está RESERVADO para mensajes del protocolo — todo logging va a stderr. Un solo `print()` suelto corrompe el protocolo.
- Los nombres de métodos deben coincidir exactamente con `RpcMethods` en `packages/shared-types/src/index.ts`. Al agregar métodos, ese archivo cambia primero (ver el skill add-rpc-method).
- La validación de params lanza `ValueError` (mapeado a INVALID_PARAMS). Los handlers nunca tiran abajo el servidor: el dispatcher ya envuelve las excepciones.

Reglas de adquisición (docs/ARCHITECTURE.md §7):
- Este proceso es el ÚNICO dueño de los puertos seriales y el ÚNICO escritor de `telemetry.db` (modo WAL, inserts por lote en transacciones únicas, `INSERT OR IGNORE` contra la constraint UNIQUE para deduplicar).
- Identidad de puerto = VID/PID + número de serie, resuelta al arranque. Nunca persistir rutas crudas `COM3`//dev/tty.
- Una cola de prioridad asyncio POR BUS: dispositivos en buses distintos se pollean en paralelo; el mismo bus se serializa. Un dispositivo lento nunca debe bloquear a los demás.
- El modo live (device.watch) nunca escribe a la DB — son datos efímeros de pantalla. El polling base (15 min) es el histórico oficial.
- Los watches live necesitan heartbeat con timeout: si el frontend muere sin unwatch, cancelá el polling live. Nunca dejar un polling rápido huérfano en un bus serial.
- Medí la duración de cada transacción Modbus por dispositivo (auto-calibración de la frecuencia live).
- La config Modbus (baudrate, timeouts, sets de registros, frecuencias) viene de perfiles de dispositivo — config, no código.

Estructura hexagonal (docs/HEXAGONAL.md §5, skill add-python-process):
- Cada paquete de dominio se organiza como `{domain.py, ports.py, service.py}` + adaptadores en su carpeta. `domain.py` = funciones puras sin I/O; puertos = `typing.Protocol`; los servicios reciben puertos por constructor.
- Los handlers de `rpc/server.py` son adaptadores de entrada delgados: parsean params, llaman al servicio, devuelven el resumen. La lógica nunca vive en el handler.
- Solo los adaptadores importan pymodbus/pandas/sqlite3.

Tooling:
- Intérprete: `apps/python-service/.venv` (Python 3.12). Corré los tests con `.venv/bin/pytest -q` y el lint con `.venv/bin/ruff check .` desde `apps/python-service`.
- Usá `from __future__ import annotations` en cada módulo.
- API async de pymodbus 3.x + pyserial-asyncio cuando llegue la adquisición; pydantic para validación de RPC/perfiles (agregarlo a las dependencies del pyproject cuando se use por primera vez).

Antes de terminar, corré pytest y ruff y reportá su salida real.
