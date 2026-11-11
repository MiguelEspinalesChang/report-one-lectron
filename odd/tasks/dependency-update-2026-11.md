# Feature: dependency-update-2026-11

**Objetivo:** Auditar todas las dependencias JS/TS y Python en busca de vulnerabilidades recientes y actualizar toda librería que pueda actualizarse sin romper lint, tests ni build.
**Rama:** `feature/dependency-update-2026-11` (desde `feature/frontend-alpha-acceptance` @ 6616c03 — apilada, la rama del alfa todavía no está mergeada a `develop`).
**Estrategia de entrega:** ask-on-risk. Commits solo con confirmación explícita del usuario (regla del proyecto). Runner: `pnpm lint`, `pnpm test`, `pnpm build`.

## Specs

- S1 — "revisa las librerias que tenemos y busca vulneravilidades de note de los ultimos meses": ejecutar `pnpm audit` y `pip-audit`, informar los advisories y cuáles quedan después de la actualización.
- S2 — "actualiza todas las librerias posibles": actualizar cada dependencia a su última versión; un upgrade de major se conserva solo si lint, tests y build siguen en verde después de la migración de código necesaria; de lo contrario se revierte y se registra acá con el motivo. (Supuesto: "posibles" = upgrades que dejan el stack en verde.)

## Tareas

- [x] T1 — S1 — Auditoría base + checks base. Ruta: inline. Commit `51c7432`.
- [x] T2 — S2 — Actualizaciones dentro de rango (patch/minor) en todos los workspaces + refresco del lockfile para dependencias transitivas. Ruta: inline. Evidencia: audit 34 → 2; lint, tests y build en verde. Commit `51c7432`.
- [x] T3 — S2 — Majors motivados por seguridad: zod 3.25→4.6.7 (un cambio de código: `z.record(z.string(), z.unknown())`), wait-on 8→9, electron 44.4.5→45.2.3. Ruta: inline. Evidencia: checks en verde; `better-sqlite3` y `argon2` cargan bajo Electron 45 (Node 24.22.2, ABI 150). Commit `51c7432`.
- [x] T4 — S2 — Majors de tooling: vite 6→8, @vitejs/plugin-vue 5→6, vitest 4→5, vue-tsc 2→3, eslint 9→10, eslint-plugin-vue 9→10 (+ `vue-eslint-parser` ahora es dependencia declarada de `@platform/eslint-config`, y su peer `eslint` subió a ^10), esbuild 0.25→0.28, @types/better-sqlite3 7→9, typescript 5.9→6.0.3 (un cambio de código: cota del genérico de `RandomSource` en `password-generator.ts`). Ruta: inline. Commit `51c7432`.
- [x] T5 — S2 — Majors del frontend: pinia 2→4, preline 4→5; argon2 0.44→0.45. Ruta: inline. Evidencia: checks en verde; el comportamiento de la UI con Preline 5 no se verificó visualmente (ver Log). Commit `51c7432`.
- [x] T6 — S2 — Python: venv actualizado; pisos de `pyproject.toml` subidos (pydantic>=2.14, pytest>=9.2) y pin de ruff movido de 0.16.8 a 0.17.4 (lint limpio, sin hallazgos nuevos). Evidencia: `pip-audit` limpio, pytest 50 ✓. Commit `51c7432`.
- [x] T7 — S1 — Auditoría final: `pnpm audit` 0 vulnerabilidades, `pip-audit` 0, `pnpm peers check` limpio. Smoke: `pnpm dev` levanta Electron 45 + sidecar + Vite 8, sin errores en el log.
- [x] T8 — S2 — Corrección del bloqueante de zod 4 encontrado por el verificador independiente: `UpdateDeviceSchema` deriva de una base sin defaults + test de regresión `apps/electron/main/ipc-schemas.spec.ts`. Ruta: inline. Evidencia en el Log. Commit `81ea63b`.

No actualizadas (motivo registrado):

- typescript 7.0.2 — rechazada: `typescript-eslint` 8.72.2 (última) lanza "typescript-eslint does not support TS 7.0" (peer `<6.1.0`). Se mantiene en 6.0.3. `@platform/eslint-config` declara `typescript ^6.0.3` como devDependency para que el peer autoinstalado no resuelva a la 7.
- @types/node 26 — se mantiene en ^22 a propósito: vitest corre en Node 22 y Electron 45 embebe Node 24; los tipos no deben superar al runtime más bajo.

## Log

- L1 (2026-11-11, usuario, textual): "antes de comenzar revisa las librerias que tenemos y busca vulneravilidades de note de los ultimos meses y actualiza todas las librerias posibles"
- Auditoría base: `pnpm audit` → 34 advisories (15 altos, 14 moderados, 5 bajos). Relevantes en runtime: electron 44.4.5 (fix >=44.9.1), vue-i18n 11.4.12 (XSS, fix >=11.4.14), zod 3.25.76 (fix >=4.6.6), undici 7.29.1 vía electron (fix >=7.30.1). Solo de desarrollo: vite 6.4.3, @vitest/mocker, follow-redirects + joi vía wait-on, fast-uri vía commitlint, source-map-js, minimatch, postcss-selector-parser. `pip-audit` → filelock 4.0.3 (10 CVE), msgpack 1.2.2 (1 CVE), ambas dependencias transitivas de herramientas de desarrollo.
- Checks base (antes de cualquier cambio): lint ✓, core 108 ✓, electron 23 ✓, frontend 11 ✓, pytest 50 ✓, build 7/7 ✓.
- El último advisory (minimatch <11.0.1, GHSA-g3hv-75wg-m249) está fijado en ^10 por `@eslint/config-array` y `@typescript-eslint/typescript-estree`; se cerró con un override en `pnpm-workspace.yaml` a ^11.0.1 (solo desarrollo, lint sigue en verde). Quitar cuando upstream actualice.
- Checks finales (todos los upgrades aplicados): lint ✓, core 108 ✓, electron 23 ✓, frontend 11 ✓, pytest 50 ✓, build 7/7 ✓, audit 0, peers limpio.
- Pendiente: verificación visual manual de la UI (dropdowns/modales/sidebar de Preline 5, login) a cargo del usuario.
- Verificador independiente (pruebas diferenciales zod 3.25.76 vs 4.6.7, pinia 2 vs 4, minimatch 10 vs 11; diff de electron.d.ts 44 vs 45): pinia 4, preline 5 (estático), electron 45, vite 8 / vitest 5, minimatch 11 → OK. Un BLOQUEANTE: en zod 4 `CreateDeviceSchema.partial()` aplica `.default()` sobre claves ausentes, por lo que `UpdateDeviceSchema.parse({id, name})` ganaba `slaveId: 1, pollingIntervalS: 900, enabled: true` y el handler de update habría sobrescrito los valores guardados (latente: el único llamador de la UI envía todos los campos). Aviso: `.int()` ahora rechaza valores fuera de ±2^53-1.
- Corrección (T8): `UpdateDeviceSchema` ahora deriva de un `DeviceFieldsSchema` sin defaults; `CreateDeviceSchema` agrega los defaults. Test de regresión `apps/electron/main/ipc-schemas.spec.ts` (4 tests). RED: "expected { name: 'renamed', slaveId: 1, … } to deeply equal { id: 5, name: 'renamed' }" → GREEN. Final: lint ✓, core 108, electron 27, frontend 11, pytest 50, build 7/7, audit 0.
- Pedido del usuario (2026-11-11, textual): "cuando terminemos manda un agente de codex sol que nos audite para que nos de el OK de estas actualizaciones." → `codex exec` con `gpt-6.1-sol`, sandbox de solo lectura.
- Auditoría de Codex (`gpt-6.1-sol`, solo lectura, 2026-11-11): **VERDICT: OK**, sin bloqueantes. 628 pruebas diferenciales de zod; la corrección de `UpdateDeviceSchema` está completa y no hay otro caso de defaults bajo partial; los hashes de argon2 0.44 verifican bajo 0.45; las APIs de Electron 45 en uso son compatibles; el override de minimatch resuelve a 11.0.6. Volvió a correr electron 27 ✓, frontend 11 ✓, eslint, ruff y typechecks. No verificó: suites completas de core/pytest, build de producción, repetición del audit, Electron empaquetado, Preline visual. Avisos: (a) vitest 5 excluye Node 20 y el repo no declara `engines.node`; (b) zod 4 ahora rechaza `scale: Infinity` y enteros mayores a 2^53-1 (endurecimiento, sin tests que lo fijen); (c) `.codex/` y `.agents/` sin trackear no tienen relación con este cambio — no incluirlos en el stage.
- Pedido del usuario (2026-11-11, textual): "antes de los commits puedes traducir todos los MD de odd/tasks y guardar que estos documento se haran en espanol" → los tres documentos de `odd/tasks/` traducidos a español neutro; desde ahora se escriben en español.
- Gotcha: `CI=true pnpm install` usa frozen-lockfile; después de editar `overrides` usar `CI=true pnpm install --no-frozen-lockfile`.
