---
name: verify-stack
description: "Trigger: verify app, run app, smoke test, probar la app, correr la app, levantar la app. Verify the full stack builds, tests and runs end to end."
license: Apache-2.0
metadata:
  author: MiguelEspinalesChang
  version: "1.0"
---

## Activation Contract

Use before declaring any change done, before commits that touch more than one layer, and whenever asked to run or verify the app.

## Execution Steps

1. `pnpm build` — must complete all workspace tasks (typechecks + vite + esbuild bundles).
2. `pnpm test` — core vitest spawns the REAL python sidecar (ping, push notification, RPC error) + pytest. Requires the venv: if missing, run `pnpm setup:python` first.
3. `pnpm lint` — eslint + ruff.
4. Smoke run: `pnpm dev` in background, then verify three processes exist: Electron (`pgrep -f "node_modules/electron/dist"`), python sidecar (`pgrep -f "main.py"`), and Vite answering on `http://127.0.0.1:5173`.
5. Kill the dev stack when verification is done unless the user wants it open.

## Known Gotchas

- Vite is pinned to `host: 127.0.0.1` — on this machine it binds IPv6-only otherwise and `wait-on` hangs forever. Do not remove the pin.
- Python resolution order (core `resolvePythonBin`): `PYTHON_BIN` env → `apps/python-service/.venv` → system `python3`. System python is 3.9; the venv (3.12) is required.
- pnpm build-script approvals live in `pnpm-workspace.yaml` under `allowBuilds` (pnpm 11 ignores `pnpm.onlyBuiltDependencies` in package.json).

## Output Contract

Report each step's real result (pass/fail with output). Never report success without having run the commands.
