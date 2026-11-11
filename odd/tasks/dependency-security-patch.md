# Feature: dependency-security-patch

**Objetivo:** Eliminar las vulnerabilidades conocidas de las dependencias JS/TS detectadas en la auditoría del 2026-09-24.
**Plan (fuente de verdad del alcance):** `docs/features/done/dependency-security-patch.md`
**Rama:** `feature/dependency-security-patch` (desde `feature/frontend-alpha-phase-0` @ 49e33dc)
**Problema / por qué:** `pnpm audit` reportó 69 advisories (1 crítico, 31 altos). Electron 34 está fuera de soporte (EOL) y se distribuye dentro de la app.
**Restricciones:** no regenerar migraciones (COLLATE NOCASE); commits solo con confirmación del usuario (regla del proyecto) — el usuario eligió commitear al final.
**TDD:** estricto (configuración de la sesión). Actualizaciones de dependencias: RED = `pnpm audit` fallando para los advisories objetivo; GREEN = audit limpio + lint/test/build. T5: RED→GREEN real con vitest. Runner: `pnpm test`.
**Estrategia de entrega:** ask-on-risk. Diff de autoría pequeño (lockfile generado, excluido).

## Tareas

- [x] T1 — `pnpm update -r` (no hicieron falta overrides). Ruta: inline (mecánica). Evidencia: audit 1c/31h/29m/8l → 1c/11h/25m/6l. lint ✓ test 92+50 ✓ build 7/7 ✓.
- [x] T2 — drizzle-orm ^0.45.3 + override acotado `@esbuild-kit/core-utils>esbuild: ^0.25.12`. Ruta: inline. Evidencia: desaparecen los advisories de drizzle-orm y esbuild 0.18; `drizzle-kit check` OK; `database/` sin cambios; tests de core 92 ✓.
- [x] T3 — vitest ^4.1.11 (se mantuvo en el major 4). Ruta: inline. Evidencia: desaparecen los advisories de vitest/vite/@vitest/mocker/esbuild 0.21; tests de core 92 ✓; no se usan APIs eliminadas.
- [x] T4 — Electron ^44.4.5 + better-sqlite3 ^13.0.3 (N-API). Se eliminaron rebuild:electron/rebuild:node, scripts/rebuild-node-sqlite.sh y @electron/rebuild; documentación actualizada (CLAUDE.md, README, installer-packaging.md). Ruta: inline (ediciones mecánicas de manifiestos y docs). Evidencia: audit **0**; better-sqlite3 carga en Node ABI 127 y Electron ABI 149; hash/verify de argon2 bajo Electron 44 ✓; smoke de `pnpm dev`: Electron 44.4.5 + sidecar + Vite 200, app.db abierta en WAL.
- [x] T5 — `navigation-policy.ts` (+8 tests) cableado en `window.ts`: `setWindowOpenHandler` deny + guard de `will-navigate`. Se agregó vitest a apps/electron. Ruta: inline (1 archivo no trivial + spec). Evidencia: RED (módulo inexistente) → GREEN 8/8; typecheck ✓; smoke de dev ✓.
- [x] T6 — `pnpm audit:deps` (`scripts/audit-deps.sh`), ruff fijado en ==0.16.8, pip-audit como dependencia de dev, fila en el README. Ruta: inline. Evidencia: audit:deps exit 0.

## Criterios de aceptación

- [x] `pnpm audit --audit-level=high` limpio (0 en total); `pip-audit` limpio.
- [x] `pnpm lint`, `pnpm test` (core 92, electron 8, python 50), `pnpm build` 7/7 en verde; smoke de `pnpm dev` en verde.
- [x] Migraciones de `database/` sin cambios.
- [ ] Smoke manual de la UI (login, catálogo, vivo) sobre Electron 44 — pendiente del usuario.

## Progreso / evidencia

- `extract-zip` no tiene versión parcheada (última 2.0.1) → se corrige únicamente vía Electron 44 (`@electron-internal/extract-zip`).
- `pnpm update -r` reescribió los rangos de los manifiestos a las versiones resueltas (comportamiento de pnpm 11).
- Fuera de alcance, preexistente: los peers opcionales de vue-router 5.x piden vite ^7 / pinia ^3.
- RDD: no evaluado por tarea (todavía sin commits — el usuario difirió los commits al final).

## Commits

Pendientes de confirmación del usuario (propuesta: plan de docs / deps T1–T4+T6 / endurecimiento de electron T5).

## Próximo paso

El usuario confirma los commits; smoke manual de la UI sobre Electron 44.
