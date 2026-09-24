# Feature: dependency-security-patch

**Objective:** Remove known vulnerabilities from JS/TS dependencies found by the 2026-09-24 audit.
**Plan (source of truth for scope):** `docs/features/done/dependency-security-patch.md`
**Branch:** `feature/dependency-security-patch` (from `feature/frontend-alpha-phase-0` @ 49e33dc)
**Problem / why:** `pnpm audit` reported 69 advisories (1 critical, 31 high). Electron 34 is EOL and ships in the app.
**Constraints:** no migration regeneration (COLLATE NOCASE); commits only with user confirmation (project rule) — user chose to commit at the end.
**TDD:** strict (session config). Dependency bumps: RED = `pnpm audit` failing for targeted advisories; GREEN = audit clean + lint/test/build. T5: real RED→GREEN with vitest. Runner: `pnpm test`.
**Delivery strategy:** ask-on-risk. Authored diff small (lockfile generated, excluded).

## Tasks

- [x] T1 — `pnpm update -r` (no overrides needed). Route: inline (mechanical). Evidence: audit 1c/31h/29m/8l → 1c/11h/25m/6l. lint ✓ test 92+50 ✓ build 7/7 ✓.
- [x] T2 — drizzle-orm ^0.45.3 + scoped override `@esbuild-kit/core-utils>esbuild: ^0.25.12`. Route: inline. Evidence: drizzle-orm + esbuild 0.18 advisories gone; `drizzle-kit check` OK; `database/` unchanged; core tests 92 ✓.
- [x] T3 — vitest ^4.1.11 (stayed on major 4). Route: inline. Evidence: vitest/vite/@vitest/mocker/esbuild 0.21 advisories gone; core tests 92 ✓; no removed APIs in use.
- [x] T4 — Electron ^44.4.5 + better-sqlite3 ^13.0.3 (N-API). Removed rebuild:electron/rebuild:node, scripts/rebuild-node-sqlite.sh, @electron/rebuild; docs updated (CLAUDE.md, README, installer-packaging.md). Route: inline (mechanical manifest/doc edits). Evidence: audit **0**; better-sqlite3 loads in Node ABI 127 and Electron ABI 149; argon2 hash/verify under Electron 44 ✓; `pnpm dev` smoke: Electron 44.4.5 + sidecar + Vite 200, app.db WAL opened.
- [x] T5 — `navigation-policy.ts` (+8 tests) wired in `window.ts`: `setWindowOpenHandler` deny + `will-navigate` guard. vitest added to apps/electron. Route: inline (1 non-trivial file + spec). Evidence: RED (module missing) → GREEN 8/8; typecheck ✓; dev smoke ✓.
- [x] T6 — `pnpm audit:deps` (`scripts/audit-deps.sh`), ruff pinned ==0.16.8, pip-audit dev dep, README row. Route: inline. Evidence: audit:deps exit 0.

## Acceptance criteria

- [x] `pnpm audit --audit-level=high` clean (0 total); `pip-audit` clean.
- [x] `pnpm lint`, `pnpm test` (core 92, electron 8, python 50), `pnpm build` 7/7 green; `pnpm dev` smoke green.
- [x] `database/` migrations unchanged.
- [ ] Manual UI smoke (login, catalog, live) on Electron 44 — pending user.

## Progress / evidence

- `extract-zip` has no patched release (latest 2.0.1) → fixed only via Electron 44 (`@electron-internal/extract-zip`).
- `pnpm update -r` rewrote manifest ranges to resolved versions (pnpm 11 behavior).
- Out of scope, pre-existing: vue-router 5.x optional peers want vite ^7 / pinia ^3.
- RDD: not assessed per task (no commits yet — user deferred commits to the end).

## Commits

Pending user confirmation (proposed: docs plan / deps T1–T4+T6 / electron hardening T5).

## Next step

User confirms commits; manual UI smoke on Electron 44.
