# Feature: frontend-alpha-acceptance

**Objective:** Close the frontend alpha plan: finish the remaining gap (§6.4 user deactivation), reconcile the plan document with the code, and run the §8 acceptance checklist.
**Plan (source of truth for scope):** `docs/features/in-progress/frontend-alpha-requirements.md`
**Branch:** `feature/frontend-alpha-acceptance` (from `develop` @ 38d153c)
**Problem / why:** Phases 0-8 are implemented, but R2.4 has no action (no backend use case), the plan document has stale checkboxes/references, and the §8 checklist has never been run end to end.
**Constraints:** hexagonal rules (`docs/HEXAGONAL.md`), one-line Electron handlers, zod at the IPC boundary, i18n EN+ES, commits only with explicit user confirmation (project rule).
**TDD:** strict (session config). Runner: `pnpm test` (vitest core/electron + pytest); focused: `pnpm --filter @platform/core exec vitest run`.
**Delivery strategy:** ask-on-risk. Forecast ~300-400 authored lines; actual so far ~221 (T1) + docs.

## Decisions

- Deactivation is a reversible toggle (`setActive(userId, isActive)`), not a one-way action — an admin can reactivate a user.
- A user cannot deactivate their own account (prevents locking out the only admin session). Enforced in core via the injected `AuthSession`; the UI disables the toggle on the own row.

## Tasks

- [x] T1 — §6.4 `users:setActive`: core use case (+ self-deactivation guard, tests) → shared-types contract → IPC handler + preload → `useUsersStore` action + toggle in `UsersView` + i18n EN/ES. Route: delegated (writer trigger: 2+ non-trivial files across 3 packages). Evidence: RED 5 failing (`setActive is not a function`) → GREEN; core 97 ✓, electron 23 ✓, pytest 50 ✓, lint ✓, build ✓ (parent re-ran core: 97 ✓). ~221 authored lines, 18 files.
- [x] T2 — Reconcile plan doc: check Phase 0/1 boxes, fix stale `rebuild:node` in Phase 6 closure, document that `useLiveStore` was not created (live state is component-local in `DeviceLiveView`), mark §6.4 done. Route: inline (single doc file). Evidence: all applied; F2 note verified against `DeviceLiveView.vue`; §8 "build y lint pasan" checked.
- [x] T4 — R2.5 / §6.5 `users:resetPassword`: an admin sets a temporary password for an `operator` or `viewer` user; the target gets `mustChangePassword = true` and must change it on next login. Core use case rejects targets with the `admin` role (`CannotResetAdminPasswordError`) and enforces the password policy (min 8); UI adds a per-row "Reset password" action (hidden on admin rows) with a modal (`AppPasswordInput` + confirmation) → shared-types contract + zod → one-line IPC handler + preload → `useUsersStore` action → i18n EN/ES. TDD: service tests (operator ok, viewer ok, admin rejected, weak password, unknown user) + integration (login with temp password → `mustChangePassword: true`). Route: delegated (writer trigger: 2+ non-trivial files across 3 packages). Evidence: RED 5 failing (`resetPassword is not a function`) → GREEN; core 103 ✓, electron 23 ✓, pytest 50 ✓, lint ✓, build ✓ (parent re-ran core: 103 ✓). Reused `UserRepository.updatePasswordHash(id, hash, true)` — no new port method. ~316 authored lines.
- [x] T5 — Secure password generator in the Users modals (create user + reset password): a "Generate" button fills password + confirmation with a random password, length selectable 8–20 (default 16), using `crypto.getRandomValues` with unbiased (rejection) sampling, guaranteeing at least one lowercase, uppercase, digit and symbol, excluding ambiguous characters (`0O1lI`), then shuffled (Fisher–Yates). Pure UI convenience util in `apps/frontend` (no business rule; backend policy stays min 8 and remains the authority). Generated value is revealed so the admin can hand it over. Adds vitest to `apps/frontend` for the util. Route: delegated (writer trigger: util + spec + component + view + i18n). Evidence: RED (module missing) → GREEN 11/11; core 103 ✓, electron 23 ✓, frontend 11 ✓, pytest 50 ✓, lint ✓, build ✓ (parent re-ran frontend: 11 ✓, reviewed util). Accepted scope addition: create-user modal gained a password confirmation field (needed so Generate fills both fields); `AppPasswordInput` got optional `revealed` prop; optional Copy button. ~500 authored lines (above the 400 heuristic: util+spec+2 modals+i18n; not split artificially).
- [ ] T5b — RDD correction (lineage `review-95812b0812fc444c`, findings `R1-setActive-no-authz`, `R1-resetPassword-no-authz`, CRITICAL): core `UserManagementService` requires an authenticated session holding `users.manage` for `setActive` and `resetPassword` (`NotAuthenticatedError` / `PermissionDeniedError`). User approved 2026-09-24; changes the §5 "UI-only enforcement" decision for these operations. Budget ≤200 lines (planned 150). Route: delegated. Evidence: RED 5 failing (authz tests resolving) → GREEN; core 108 ✓, electron 23 ✓, frontend 11 ✓, pytest 50 ✓, lint ✓, build ✓ (parent re-ran core: 108 ✓, reviewed guard). 176 authored lines, 8 files. Uncommitted — awaiting user confirmation.
- [ ] T6 — Backend permission enforcement for the remaining user-management operations (`createUser`, `assignRole`) and review of §5 for the rest of the IPC surface. Pre-existing gap (not introduced by this branch) found by the RDD risk lens; out of the frozen correction scope.
- [ ] T3 — §8 acceptance: automated part (`pnpm lint`, `pnpm test`, `pnpm build`) done in T1; manual UI walk-through with the 3 roles (incl. the new deactivate toggle) by the user. Route: inline (per-action checks).

## Acceptance criteria

- [x] Admin can deactivate/reactivate another user; a deactivated user gets `InactiveUserError` on login; self-deactivation is rejected. (Proven by unit + integration tests; UI toggle pending manual check in T3.)
- [x] `pnpm lint`, `pnpm test`, `pnpm build` green.
- [ ] §8 checklist fully checked (manual items confirmed by the user).

## Progress / evidence

- T4 added by user request 2026-09-24 (admin resets operator/viewer passwords).
- `auth-service.spec.ts` needed a no-op `setActive` on its own fake repository (widened port).
- Commit split (user chose option A): T1+T4 share most files, so they went in one commit; T5 bits were stripped from `UsersView.vue`/i18n for commit 1 and restored after. Final tree verified identical to the pre-split state. Each commit was built/tested/linted in isolation (stash `--keep-index`).
- ES strings for the new errors were changed from voseo to neutral Spanish ("No es posible …") to match `es.json`.
- Restart gotcha: new IPC handlers/preload need a full `pnpm dev` restart (Vite HMR only reloads the renderer).

## Commits

- `c44917a` feat(users): ✨ activar/desactivar y resetear contraseña de usuarios — T1 + T4. build 7/7, core 103, electron 23, pytest 50, lint ✓.
- `84ce0b7` feat(frontend): ✨ generador de contraseñas seguras en los modales de usuarios — T5. build 7/7, core 103, electron 23, frontend 11, pytest 50, lint ✓.
- docs commit — T2 + this document.

## Next step

T3: user runs the manual §8 walk-through with the 3 roles and reports results.
