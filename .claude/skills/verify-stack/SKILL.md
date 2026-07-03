---
name: verify-stack
description: "Trigger: verify app, run app, smoke test, probar la app, correr la app, levantar la app, verificar. Verifica que el stack completo compile, teste y corra de punta a punta."
license: Apache-2.0
metadata:
  author: MiguelEspinalesChang
  version: "1.0"
---

## Contrato de activación

Usar antes de declarar terminado cualquier cambio, antes de commits que toquen más de una capa, y cada vez que pidan correr o verificar la app.

## Pasos

1. `pnpm build` — deben completarse todas las tareas del workspace (typechecks + vite + bundles esbuild).
2. `pnpm test` — el vitest de core levanta el sidecar Python REAL (ping, notificación push, error RPC) + pytest. Requiere el venv: si falta, correr `pnpm setup:python` primero.
3. `pnpm lint` — eslint + ruff.
4. Smoke run: `pnpm dev` en segundo plano, y verificar que existan los tres procesos: Electron (`pgrep -f "node_modules/electron/dist"`), sidecar python (`pgrep -f "main.py"`) y Vite respondiendo en `http://127.0.0.1:5173`.
5. Matar el stack de dev al terminar la verificación, salvo que el usuario lo quiera abierto.

## Gotchas conocidos

- Vite está fijado a `host: 127.0.0.1` — en esta máquina se engancha solo a IPv6 sin eso y `wait-on` espera para siempre. No quitar el pin.
- Orden de resolución de Python (`resolvePythonBin` de core): variable `PYTHON_BIN` → `apps/python-service/.venv` → `python3` del sistema. El python del sistema es 3.9; el venv (3.12) es obligatorio.
- Las aprobaciones de build scripts de pnpm viven en `pnpm-workspace.yaml` bajo `allowBuilds` (pnpm 11 ignora `pnpm.onlyBuiltDependencies` en package.json).

## Contrato de salida

Reportar el resultado real de cada paso (pasa/falla con la salida). Nunca reportar éxito sin haber corrido los comandos.
