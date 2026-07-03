# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Offline-first desktop platform for Modbus device management, data acquisition and reporting. The normative architecture document is `docs/ARCHITECTURE.md` (Spanish) — when in doubt, it wins.

## Commands

```bash
pnpm install            # all JS/TS workspaces (pnpm 11 + Turborepo)
pnpm setup:python       # creates apps/python-service/.venv (Python 3.11+, pytest, ruff) — required for tests
pnpm dev                # full stack: Vite (HMR) + Electron + Python sidecar spawned by Electron
pnpm build              # typechecks + vite build + esbuild bundles for electron main/preload
pnpm lint               # eslint (TS/Vue) + ruff (python, via scripts/lint-python.sh)
pnpm test               # vitest + pytest (via scripts/test-python.sh)
```

Scoped runs:

```bash
pnpm --filter @platform/core test                     # integration test: spawns the REAL python sidecar
pnpm --filter @platform/core exec vitest run -t "ping" # single vitest test by name
pnpm --filter @platform/frontend build                # typecheck the UI only
cd apps/python-service && .venv/bin/pytest -q          # python tests
cd apps/python-service && .venv/bin/ruff check .       # python lint
```

## Architecture (big picture)

Three processes, strict ownership, contracts in one place:

```
Vue renderer ──ipcRenderer.invoke──▶ Electron main ──direct call──▶ packages/core ──JSON-RPC 2.0 stdio──▶ Python sidecar
     ▲                                    │                              ▲                                     │
     └────── webContents.send ◀───────────┴── bridge 'notification' ◀────┴────── self.notify(...) ◀───────────┘
```

- **`packages/shared-types`** is the single source of truth for every cross-boundary contract (`RpcMethods`, `IpcChannels`, DTOs, `PlatformApi`). Python mirrors the method-name strings **manually**: the `_handlers()` dict in `apps/python-service/rpc/server.py` must match `RpcMethods` values. Changing one side without the other breaks silently.
- Adding any RPC method or push event touches ~5 files across 3 processes — follow `.claude/skills/add-rpc-method/SKILL.md`.
- **Process vs protocol split**: `apps/electron/main/python-manager.ts` owns the sidecar process (spawn, restart on crash, shutdown); `packages/core/src/python-bridge/client.ts` owns the JSON-RPC protocol and gets attached to the child's stdio. Push events flow: python `notify` → bridge `'notification'` event → `main/events.ts` maps method→channel → `webContents.send` → preload subscription.
- **Python interpreter resolution** (`resolvePythonBin` in core): `PYTHON_BIN` env → `apps/python-service/.venv` → system `python3`. System python here is 3.9; the venv (3.12) is required.
- Non-negotiable ownership rules (`docs/ARCHITECTURE.md` §11): Electron handlers are one-line delegations, zero business logic; Vue only invokes/listens/renders; core is a library — no HTTP, no open ports; python is the only serial-port owner and only `telemetry.db` writer; core is the only `app.db` writer; massive data never crosses process boundaries (only summaries/events); zod validates IPC boundaries, python validates RPC params.
- **Not implemented yet**: the DB layer (better-sqlite3 + drizzle for `app.db`) was deliberately deferred — the native module needs a rebuild against Electron's ABI. Real Modbus acquisition, CSV imports and reports are placeholder packages with docstrings.

## Environment gotchas

- pnpm 11 reads build-script approvals from `pnpm-workspace.yaml` (`allowBuilds:`); it ignores `pnpm.onlyBuiltDependencies` in package.json.
- Turbo requires the `packageManager` field in the root package.json.
- Vite is pinned to `host: 127.0.0.1` (`apps/frontend/vite.config.ts`) because it bound IPv6-only on this machine and `wait-on tcp:127.0.0.1:5173` hung forever. Electron loads `http://127.0.0.1:5173` in dev. Do not "clean up" the pin.
- `apps/python-service/pyproject.toml` needs `[tool.setuptools.packages.find] include=[...]` — setuptools rejects the flat layout otherwise.
- In the sidecar, stdout is reserved for JSON-RPC; log to stderr only.

## Git

- Flow: `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`. Never commit directly to `main` or `develop`.
- Conventional commits, no AI attribution.
- Remote uses the SSH host alias `github.com-personal` (personal key). Keep it when re-adding remotes.

## AI tooling

- Agents (`.claude/agents/`): `arch-guard` (adversarial boundary review before commits/PRs, read-only), `modbus-sidecar` (python data-core implementation).
- Skills (`.claude/skills/`): `add-rpc-method`, `add-island`, `verify-stack`. Registry in `AGENTS.md`.
