# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Plataforma de escritorio offline-first para gestión de dispositivos Modbus, adquisición de datos y reportería. Documentos normativos: `docs/ARCHITECTURE.md` (qué hace cada proceso) y `docs/HEXAGONAL.md` (cómo se organiza el código dentro de cada proceso: dominio/puertos/adaptadores). Ante cualquier duda, esos documentos mandan.

## Comandos

```bash
pnpm install            # todos los workspaces JS/TS (pnpm 11 + Turborepo)
pnpm setup:python       # crea apps/python-service/.venv (Python 3.11+, pytest, ruff) — requerido para los tests
pnpm dev                # stack completo: Vite (HMR) + Electron + sidecar Python (lo spawnea Electron)
pnpm build              # typechecks + build de vite + bundles esbuild para main/preload de electron
pnpm lint               # eslint (TS/Vue) + ruff (python, vía scripts/lint-python.sh)
pnpm test               # vitest + pytest (vía scripts/test-python.sh)
```

Ejecuciones puntuales:

```bash
pnpm --filter @platform/core test                      # test de integración: levanta el sidecar Python REAL
pnpm --filter @platform/core exec vitest run -t "ping" # un solo test de vitest por nombre
pnpm --filter @platform/frontend build                 # typecheck solo de la UI
cd apps/python-service && .venv/bin/pytest -q          # tests de python
cd apps/python-service && .venv/bin/ruff check .       # lint de python
```

## Arquitectura (visión general)

Tres procesos, propiedad estricta, contratos en un solo lugar:

```
Vue renderer ──ipcRenderer.invoke──▶ Electron main ──llamada directa──▶ packages/core ──JSON-RPC 2.0 stdio──▶ sidecar Python
     ▲                                    │                                  ▲                                     │
     └────── webContents.send ◀───────────┴── evento 'notification' ◀────────┴────── self.notify(...) ◀───────────┘
```

- **`packages/shared-types`** es la única fuente de verdad de todo contrato entre fronteras (`RpcMethods`, `IpcChannels`, DTOs, `PlatformApi`). Python replica los strings de nombres de método **manualmente**: el dict `_handlers()` en `apps/python-service/rpc/server.py` debe coincidir con los valores de `RpcMethods`. Cambiar un lado sin el otro rompe en silencio.
- Agregar cualquier método RPC o evento push toca ~5 archivos en 3 procesos — seguir `.claude/skills/add-rpc-method/SKILL.md`.
- **Separación proceso vs protocolo**: `apps/electron/main/python-manager.ts` es dueño del proceso sidecar (spawn, reinicio ante crash, apagado); `packages/core/src/python-bridge/client.ts` es dueño del protocolo JSON-RPC y se conecta al stdio del hijo. Los eventos push fluyen: `notify` de python → evento `'notification'` del bridge → `main/events.ts` mapea método→canal → `webContents.send` → suscripción en el preload.
- **Resolución del intérprete Python** (`resolvePythonBin` en core): variable `PYTHON_BIN` → `apps/python-service/.venv` → `python3` del sistema. El python del sistema acá es 3.9; el venv (3.12) es obligatorio.
- Reglas de propiedad no negociables (`docs/ARCHITECTURE.md` §11): los handlers de Electron son delegaciones de una línea, cero lógica de negocio; Vue solo invoca/escucha/pinta; core es una librería — sin HTTP, sin puertos abiertos; python es el único dueño de puertos seriales y único escritor de `telemetry.db`; core es el único escritor de `app.db`; los datos masivos nunca cruzan fronteras de proceso (solo resúmenes/eventos); zod valida las fronteras IPC, python valida los params RPC.
- **Todavía no implementado**: la capa de base de datos (better-sqlite3 + drizzle para `app.db`) se difirió a propósito — el módulo nativo necesita rebuild contra el ABI de Electron. La adquisición Modbus real, importación CSV y reportes son paquetes placeholder con docstrings.

## Convenciones del frontend

- **Estilos**: Tailwind CSS v4 (plugin `@tailwindcss/vite`, sin tailwind.config — tokens en `@theme` dentro de `src/assets/main.css`). Jerarquía: utilidades Tailwind → clases compartidas `.island`/`.btn` (`@layer components`) → `<style module>` para lo específico del componente. Prohibido CSS global fuera de `main.css`.
- **i18n**: vue-i18n (composition, `legacy: false`), locales EN/ES en `src/i18n/locales/*.json`. Todo texto visible pasa por `t('...')` y se agrega en AMBOS archivos. La elección persiste en localStorage (`setLocale` en `src/i18n/index.ts`); default por `navigator.language`.

## Gotchas del entorno

- pnpm 11 lee las aprobaciones de build scripts desde `pnpm-workspace.yaml` (`allowBuilds:`); ignora `pnpm.onlyBuiltDependencies` en package.json.
- Turbo requiere el campo `packageManager` en el package.json raíz.
- Vite está fijado a `host: 127.0.0.1` (`apps/frontend/vite.config.ts`) porque en esta máquina se enganchaba solo a IPv6 y `wait-on tcp:127.0.0.1:5173` esperaba para siempre. Electron carga `http://127.0.0.1:5173` en dev. NO "limpiar" ese pin.
- `apps/python-service/pyproject.toml` necesita `[tool.setuptools.packages.find] include=[...]` — setuptools rechaza el layout plano sin eso.
- En el sidecar, stdout está reservado para JSON-RPC; loguear solo a stderr.

## Git y hooks (husky)

- Flujo: `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`. Nunca commitear directo a `main` ni `develop` — el hook `pre-commit` lo BLOQUEA.
- `pre-commit` (`.husky/pre-commit`): guard de rama + `lint-staged` (eslint --fix sobre TS/Vue staged, ruff --fix sobre python staged vía `scripts/ruff-staged.sh`; ruff se salta con warning si falta el venv).
- `commit-msg` (`.husky/commit-msg`): commitlint con `@commitlint/config-conventional` — el mensaje DEBE ser conventional commit (`feat:`, `fix:`, `docs:`, `chore:`...). Sin atribución de IA.
- Los hooks se instalan con `pnpm install` (script `prepare`). Si un commit falla, leer el error del hook — no usar `--no-verify` salvo emergencia explícita del usuario.
- El remote usa el alias SSH `github.com-personal` (llave personal). Mantenerlo al re-agregar remotes.

### Higiene de ramas

- GitHub debe tener activado **"Automatically delete head branches"** (Settings → General): al mergear un PR, la rama remota se borra sola. En el remote solo viven `main`, `develop` y las ramas con trabajo activo.
- El repo tiene `fetch.prune = true` (config local): cada fetch/pull limpia las referencias remotas muertas.
- `pnpm branches:clean` (`scripts/git-clean-branches.sh`): borra las ramas locales cuyo upstream ya no existe (PRs mergeados). Nunca toca `main` ni `develop`. Corre SOLA vía el hook `post-merge` (cada `git pull` con merge); también se puede invocar a mano.
- Política acordada: la limpieza ocurre ÚNICAMENTE vía merge de PR — NUNCA por antigüedad. Un feature puede vivir semanas sin mergearse y sigue siendo trabajo activo. No agregar actions de "stale branches" por timer.
- Las ramas remotas nunca se borran a mano salvo abandono explícito de un feature — el borrado normal lo hace GitHub al mergear.

## Reglas de TypeScript

El preset `packages/tsconfig/base.json` (heredado por TODOS los paquetes) exige además de `strict`: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess` (todo acceso por índice devuelve `T | undefined` — chequear antes de usar) y `verbatimModuleSyntax` (los imports solo-de-tipos DEBEN usar `import type` / `{ type X }`). ESLint suma: `consistent-type-imports` (inline), `no-unused-vars` con prefijo `_` permitido, `no-console` (solo `warn`/`error`) y `eqeqeq`.

## Tooling de IA

- Agentes (`.claude/agents/`): `arch-guard` (revisión adversarial de fronteras + regla hexagonal antes de commits/PRs, solo lectura), `modbus-sidecar` (implementación del núcleo de datos Python).
- Skills (`.claude/skills/`): `add-feature`, `add-python-process`, `add-rpc-method`, `add-island`, `verify-stack`. Registro en `AGENTS.md`.
