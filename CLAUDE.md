# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Plataforma de escritorio offline-first para gestión de dispositivos Modbus, adquisición de datos y reportería. Documentos normativos: `docs/ARCHITECTURE.md` (qué hace cada proceso) y `docs/HEXAGONAL.md` (cómo se organiza el código dentro de cada proceso: dominio/puertos/adaptadores). Ante cualquier duda, esos documentos mandan.

Planes de features: `docs/features/`, organizados como pipeline por carpeta (raíz = backlog, `in-progress/`, `paused/`, `rejected/`, `done/`). La carpeta ES el estado; al cambiar de etapa se mueve con `git mv` y se actualizan las referencias. Reglas en `docs/features/README.md`.

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
- **Todavía no implementado**: tablas de dominio de `app.db` (usuarios, roles, permisos, dispositivos) — se agregan en Fase 1 y 2. La adquisición Modbus real, importación CSV y reportes son paquetes placeholder con docstrings.

## Convenciones del frontend

- **Estilos**: Tailwind CSS v4 (plugin `@tailwindcss/vite`, sin tailwind.config — tokens en `@theme` dentro de `src/assets/main.css`). Jerarquía: utilidades Tailwind → clases compartidas `.island`/`.btn` (`@layer components`) → `<style module>` para lo específico del componente. Prohibido CSS global fuera de `main.css`.
- **i18n**: vue-i18n (composition, `legacy: false`), locales EN/ES en `src/i18n/locales/*.json`. Todo texto visible pasa por `t('...')` y se agrega en AMBOS archivos. La elección persiste en localStorage (`setLocale` en `src/i18n/index.ts`); default por `navigator.language`.

## Gotchas del entorno

- pnpm 11 lee las aprobaciones de build scripts desde `pnpm-workspace.yaml` (`allowBuilds:`); ignora `pnpm.onlyBuiltDependencies` en package.json.
- Turbo requiere el campo `packageManager` en el package.json raíz.
- Vite está fijado a `host: 127.0.0.1` (`apps/frontend/vite.config.ts`) porque en esta máquina se enganchaba solo a IPv6 y `wait-on tcp:127.0.0.1:5173` esperaba para siempre. Electron carga `http://127.0.0.1:5173` en dev. NO "limpiar" ese pin.
- `apps/python-service/pyproject.toml` necesita `[tool.setuptools.packages.find] include=[...]` — setuptools rechaza el layout plano sin eso.
- En el sidecar, stdout está reservado para JSON-RPC; loguear solo a stderr.
- **Artefactos locales no relocalizables** (`node_modules`, `.venv`, `*.egg-info`, build nativo de better-sqlite3): si el proyecto se clona en otra máquina o se MUEVE de carpeta, se regeneran, no se copian. Pasos en la sección "Generated local artifacts" del `README.md`. `pnpm install` sin TTY aborta el purge de módulos → usar `CI=true pnpm install`.
- **ABI de better-sqlite3 (dos builds, dos usos):** el módulo nativo tiene que estar compilado contra el ABI correcto según quién lo carga. Electron 34 usa `MODULE_VERSION 132`; Node 22 usa `MODULE_VERSION 127`. Son incompatibles.
  - `pnpm rebuild:electron` → compila para Electron (requerido para `pnpm dev` y el build de distribución).
  - `pnpm rebuild:node` → restaura el build de Node (requerido para `pnpm test` / vitest).
  - `pnpm install` por sí solo NO restaura el build de Node si el binario ya existe — el script `rebuild:node` lo elimina y corre `prebuild-install` directamente.
  - Flujo típico de desarrollo: `pnpm install` (la primera vez, queda en Node-ABI) → `pnpm test` funciona. Si en algún momento corriste `pnpm rebuild:electron`, antes de volver a testear corré `pnpm rebuild:node`.
  - Ambos scripts resuelven versiones y rutas dinámicamente: `rebuild:electron` deja que electron-rebuild detecte la versión de Electron instalada; `scripts/rebuild-node-sqlite.sh` resuelve better-sqlite3 y prebuild-install con `require.resolve` desde `packages/core`. Sobreviven bumps de versión sin tocar nada.
- **argon2 NO necesita rebuild** (a diferencia de better-sqlite3): es N-API puro, el mismo prebuilt (`prebuilds/darwin-arm64`) carga bajo Node y bajo Electron sin recompilar. Sí necesita `argon2: true` en `allowBuilds` de `pnpm-workspace.yaml`.
- **Módulos nativos y el bundle de Electron:** el main de Electron se bundlea con esbuild en formato CJS. Los módulos nativos (`better-sqlite3`, `argon2`) están en `external:` del `esbuild.config.mjs` Y declarados como dependencias de `apps/electron` (pnpm aisla node_modules — sin la dependencia directa, el `require` en runtime no resuelve). Nunca bundlear un módulo nativo: su loader resuelve el `.node` relativo a su propio `__dirname`.
- **`import.meta` en código de core que llega al bundle CJS:** esbuild lo reescribe a `{}` (queda `undefined`). `packages/core/src/persistence/adapters/sqlite-database.ts` lo maneja (`import.meta.url ?? __filename`) y por eso la carpeta de migraciones se INYECTA desde Electron main (`migrationsFolder`) — el default relativo al fuente solo funciona bajo vitest/ESM.
- **`COLLATE NOCASE` en `users.username`:** drizzle no lo puede expresar; vive solo en el SQL de la migración (parcheado a mano). Regenerar esa migración con drizzle-kit lo pierde en silencio — ver `database/README.md`.

## Git y hooks (husky)

- Flujo: `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`. Nunca commitear directo a `main` ni `develop` — el hook `pre-commit` lo BLOQUEA.
- **NUNCA commitear sin preguntar primero.** Todo commit se propone al developer (qué archivos, qué mensaje) y se ejecuta solo con su confirmación explícita. Aplica también dentro de skills y sub-agentes.
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
