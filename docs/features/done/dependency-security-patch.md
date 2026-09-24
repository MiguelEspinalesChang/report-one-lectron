# Parche de seguridad de dependencias

**Estado:** HECHO (T1–T6, verificado 2026-09-24) — queda el smoke manual de UI (login, catálogo, vivo) sobre Electron 44
**Rama:** `feature/dependency-security-patch` (Electron 44 quedó en la misma rama: la superficie de API usada es mínima y el smoke pasó)
**Fecha de auditoría:** 2026-09-24
**Fuentes:** `pnpm audit` (GitHub Advisory Database), `pip-audit` (PyPI/OSV), guías de migración vía Context7 (`/electron/electron`, `/vitest-dev/vitest/v4.1.6`)

---

## 1. Resultado de la auditoría

| Ecosistema | Resultado |
|---|---|
| JS/TS (`pnpm audit`) | **69 advisories**: 1 crítica, 31 altas, 29 moderadas, 8 bajas |
| Python (`pip-audit`, `apps/python-service`) | **Sin vulnerabilidades conocidas** (pydantic 2.13.5, pytest, ruff) |

> Nota: pnpm no evita vulnerabilidades en las versiones que se usan. Reduce superficie (node_modules estricto, `allowBuilds` bloquea scripts de instalación), pero un CVE en una versión resuelta sigue presente.

### 1.1 Dependencias que viajan en la app (runtime)

| Paquete | Actual | Corregido en | Severidad máx. | Exposición real hoy |
|---|---|---|---|---|
| `electron` | 34.5.8 (fuera de soporte) | **≥ 39.8.10** (estable: 44.4.5) | alta (use-after-free, bypass de context isolation, iframes sandbox) | **Alta.** Es el runtime de la app. Electron solo soporta las 3 últimas majors (42–44). |
| `drizzle-orm` | 0.44.7 | ≥ 0.45.2 | alta (SQL injection vía identificadores mal escapados) | **Baja.** `packages/core/src` no usa `sql.raw`/`sql.identifier` ni identificadores dinámicos. Parchear igual: es un bump menor. |
| `extract-zip` (dep. de `electron`) | ≤ 2.0.1 | ≥ 2.0.2 | alta (path traversal por symlinks) | **Baja.** Solo corre en el postinstall de Electron al descargar su binario. |

### 1.2 Dependencias solo de desarrollo / build

| Paquete | Vía | Corregido en | Severidad | Exposición |
|---|---|---|---|---|
| `vitest` | `packages/core` (2.1.9) | ≥ 4.1.11 | **crítica** (lectura/ejecución de archivos con la UI de Vitest escuchando) + moderada (path traversal en `@vitest/mocker`) | Baja: no se usa `vitest --ui`. Pero es la única crítica → prioridad. |
| `vite` | vía vitest 2 (5.4.21) | ≥ 6.4.3 | alta (bypass `server.fs.deny` en Windows) | Solo dev server. Se corrige al subir vitest. |
| `postcss`, `nanoid` | `@tailwindcss/vite` → vite | ≥ 8.5.23 / ≥ 3.3.18 | alta | Build del frontend. |
| `esbuild` | `drizzle-kit` → `@esbuild-kit/*` | ≥ 0.24.3 | moderada | Solo al generar migraciones. |
| `brace-expansion` | eslint, vue-tsc, typescript-eslint | 1.1.18 / 2.1.4 / 5.0.9 | alta (DoS) | Tooling local. |
| `fast-uri`, `js-yaml` | commitlint | ≥ 3.1.6 / ≥ 4.3.2 | alta | Hooks de git. |
| `tar`, `undici` | `@electron/rebuild` → node-gyp | ≥ 7.5.21 / ≥ 6.28.0 | alta / moderada | Solo en rebuild nativo. |
| `joi` | `wait-on` | ≥ 18.2.5 | baja | Script de dev. |

---

## 2. Impacto de migración (verificado)

- **Electron 34 → 44** (Context7, `breaking-changes.md`):
  - `session.setPreloads` deprecado en 35 → **no se usa** (el preload va por `webPreferences.preload`).
  - v41: los PDF ya no crean un `WebContents` aparte → no aplica.
  - `apps/electron/main/window.ts` ya usa `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, y el preload expone wrappers, no `ipcRenderer` → cumple el modelo recomendado.
  - **Riesgo principal:** el ABI nativo. `better-sqlite3` 11.x tiene que compilar contra el Node embebido de Electron 44; seguramente haga falta subir a 12.x/13.x (13.0.3 exige Node ≥ 22). `argon2` es N-API → no debería necesitar cambios, pero hay que verificarlo.
- **Vitest 2 → 4** (Context7, `migration.md`): se quitaron las opciones como tercer argumento de `test()`, `workspace`, `poolMatchGlobs` y `deps.inline`/`external` → **ninguna se usa** en el repo (verificado con `rg`).
- **drizzle-orm 0.44 → 0.45**: bump menor. ⚠️ **No** regenerar migraciones con drizzle-kit (se pierde el `COLLATE NOCASE` de `users.username`; ver `database/README.md`).

---

## 3. Tareas

Todas verificadas el 2026-09-24 contra el estado real del repo (`pnpm ls`, `pnpm why`, `rg`) y con `pnpm lint`, `pnpm test`, `pnpm build` y `pnpm audit:deps` en verde.

- [x] **T1 — Transitivas de tooling.** Alcanzó con `pnpm update -r` dentro de los rangos actuales: no hicieron falta overrides (ver §6). Audit: 1c/31h/29m/8l → 1c/11h/25m/6l.
- [x] **T2 — drizzle-orm 0.45.3 + drizzle-kit 0.31.11.** Override acotado `@esbuild-kit/core-utils>esbuild: ^0.25.12` para el esbuild 0.18 que arrastra drizzle-kit. `drizzle-kit check` OK; `database/` sin cambios; tests de core 92/92.
- [x] **T3 — vitest 4.1.11.** Se quedó en la major 4 (primera versión con el parche). vite 5 y esbuild 0.21 fuera del árbol; tests de core 92/92 sin cambios de config.
- [x] **T4 — Electron 44.4.5 + better-sqlite3 13.0.3 (N-API).** Sin rama propia: la superficie de API usada es mínima (`ipcMain.handle`, `contextBridge`, `app.*`, `dialog.showErrorBox`). El mismo binario de better-sqlite3 carga en Node (ABI 127) y en Electron (ABI 149) → se eliminaron `rebuild:electron`, `rebuild:node`, `scripts/rebuild-node-sqlite.sh` y `@electron/rebuild`. argon2 verificado bajo Electron 44. Smoke de `pnpm dev`: Electron + sidecar + Vite arriba, `app.db` abierta.
- [x] **T5 — Hardening de ventanas.** `apps/electron/main/navigation-policy.ts` (función pura, 8 tests, RED → GREEN) conectada en `window.ts`: `setWindowOpenHandler` → deny y guardia en `will-navigate`. Primer runner de vitest en `apps/electron`.
- [x] **T6 — Prevención.** `pnpm audit:deps` (`scripts/audit-deps.sh`: `pnpm audit --audit-level=high` + `pip-audit`), `ruff==0.16.8`, `pip-audit` como dev dep y fila en el README.

## 4. Criterios de aceptación

- [x] `pnpm audit --audit-level=high` sin hallazgos → **0 advisories en total**.
- [x] `pip-audit` sin hallazgos.
- [x] `pnpm lint`, `pnpm test` (core 92, electron 8, python 50) y `pnpm build` (7/7) en verde; smoke de `pnpm dev` en verde tras T4.
- [x] Migraciones de `database/` sin cambios.
- [ ] Smoke manual de UI sobre Electron 44 (login, catálogo, vivo): pendiente del developer.

## 5. Orden y entrega

T1 → T2 → T3 son bajo riesgo y pueden ir en un solo PR. T4 va aparte (el cambio más grande, el que requiere smoke manual y el de riesgo real de ABI). T5 y T6 son independientes.

## 6. Resultado (2026-09-24)

- `pnpm audit`: **0** advisories (antes: 1 crítica, 31 altas, 29 moderadas, 8 bajas). `pip-audit`: limpio.
- Desvíos respecto al plan:
  - **T1:** alcanzó con `pnpm update -r`; no hicieron falta overrides para las transitivas.
  - **`extract-zip`:** no existe versión corregida (la última es 2.0.1). Lo resolvió Electron 44, que usa `@electron-internal/extract-zip`.
  - **`esbuild` vía drizzle-kit:** override acotado `@esbuild-kit/core-utils>esbuild: ^0.25.12` en `pnpm-workspace.yaml` (drizzle-kit 1.0 sigue en RC). Verificado con `drizzle-kit check`.
  - **T4:** better-sqlite3 **13** es N-API: el mismo binario carga en Node (ABI 127) y en Electron 44 (ABI 149). Se eliminaron `rebuild:electron`, `rebuild:node`, `scripts/rebuild-node-sqlite.sh` y `@electron/rebuild`.
  - **T5:** la política de navegación quedó en `apps/electron/main/navigation-policy.ts`, con tests (primer runner de vitest en `apps/electron`).
- Fuera de alcance, preexistente: los peers opcionales de vue-router 5.x piden vite ^7 / pinia ^3.
