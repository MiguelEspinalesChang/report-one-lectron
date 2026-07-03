# report-one-lectron

Desktop platform for device management, Modbus data acquisition and reporting.
Offline-first Electron app with a Python sidecar as the data core.

Full architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Frontend | Vue 3 + TypeScript (islands) |
| Business core | `packages/core` — pure TS library (no HTTP server) |
| Data core | Python 3.11+ sidecar (JSON-RPC 2.0 over stdio) |
| Database | SQLite (WAL): `app.db` + `telemetry.db` |
| Monorepo | pnpm workspaces + Turborepo |

## Communication chain

```
Vue → ipcRenderer.invoke → Electron main → packages/core → JSON-RPC stdio → Python
Vue ← webContents.send  ← Electron main ← bridge events  ← notifications  ← Python
```

## Getting started

```bash
pnpm install          # installs all JS/TS workspaces
pnpm setup:python     # creates apps/python-service/.venv (needs Python 3.11+)
pnpm dev              # starts Vite + Electron (Electron spawns the Python sidecar)
```

## Scripts

| Command | Action |
|---|---|
| `pnpm dev` | Start the whole platform (Vite HMR + Electron + Python sidecar) |
| `pnpm build` | Typecheck and build every project |
| `pnpm lint` | ESLint (TS/Vue) + ruff (Python) |
| `pnpm test` | vitest (TS) + pytest (Python) |
| `pnpm clean` | Remove build artifacts |
| `pnpm installer` | Build the installer (not configured yet) |

## Layout

```
apps/
  electron/        # shell: main process, preload, thin IPC handlers
  frontend/        # Vue 3 islands — UI only, zero business logic
  python-service/  # data core: Modbus acquisition, ingest, CSV, reports
packages/
  core/            # business logic library (TS, no server)
  shared-types/    # DTOs, IPC/RPC contracts — single source of truth
  shared-utils/    # generic utilities
  ui-components/   # shared Vue components
  config/          # shared constants
  eslint-config/   # flat ESLint config
  tsconfig/        # shared tsconfig presets
database/          # migrations for app.db and telemetry.db
scripts/           # setup and CI helpers
installer/         # electron-builder + PyInstaller packaging (pending)
docs/              # architecture documents
```

## Git flow

Branches: `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`.
Never commit directly to `main` or `develop`.
