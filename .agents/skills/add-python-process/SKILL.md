---
name: add-python-process
description: "Trigger: new python process, proceso de python, python job, importador, parser, writer, scheduler job. Crea un proceso hexagonal en apps/python-service con Protocols como puertos."
license: Apache-2.0
metadata:
  author: MiguelEspinalesChang
  version: "1.0"
---

## Contrato de activación

Usar al agregar lógica al sidecar Python (importación, escritura, downsampling, adquisición, reportes). Guía completa con ejemplos: `docs/HEXAGONAL.md` §5.

## Reglas duras

- Estructura por paquete de dominio: `<paquete>/{domain.py, ports.py, service.py}` + adaptadores en su carpeta (`csv_parsers/`, `transports/`, `storage/`).
- `domain.py` contiene funciones PURAS: sin I/O, sin reloj, sin random. Mismo input → mismo output. Testeables con datos en memoria.
- Puertos = `typing.Protocol` en `ports.py`. Los servicios reciben puertos por constructor.
- Los adaptadores son los únicos que importan pymodbus/pandas/sqlite3. Agregar la librería a `pyproject.toml` dependencies la primera vez que se usa.
- El handler en `rpc/server.py` es un adaptador de entrada DELGADO: parsea params, llama al servicio, devuelve resumen. La lógica nunca vive en el handler.
- stdout reservado al protocolo JSON-RPC — logging solo a stderr. Progreso hacia la UI vía `self.notify(...)`.
- Jobs largos nunca bloquean el loop: tareas asyncio con progreso por notificaciones.
- `from __future__ import annotations` en cada módulo.

## Pasos

1. `domain.py`: la transformación/regla pura.
2. `ports.py`: Protocols de lo que el proceso necesita (writer, parser, transport).
3. Adaptadores concretos en su carpeta.
4. `service.py`: caso de uso que orquesta (puertos por constructor).
5. Cablear en el composition root (`main.py` / arranque del server) y registrar el handler RPC si aplica (skill `add-rpc-method`).
6. Tests: dominio puro directo; servicio con fakes de los Protocols; adaptadores con integración real.
7. `.venv/bin/pytest -q` y `.venv/bin/ruff check .` desde `apps/python-service` — reportar salida real.

## Contrato de salida

Módulos creados por capa, handler registrado (si aplica), pytest y ruff en verde.
