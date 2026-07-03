---
name: add-island
description: "Trigger: new island, new view, new screen, nueva isla, nueva vista. Create a Vue island wired to the platform bridge, UI-only."
license: Apache-2.0
metadata:
  author: MiguelEspinalesChang
  version: "1.0"
---

## Activation Contract

Use when creating or extending a UI view in `apps/frontend`. Islands render and react — they never decide.

## Hard Rules

- Islands live in `apps/frontend/src/islands/<Area>/<Name>.vue`, PascalCase, multi-word component names.
- UI only: no aggregation, no CSV validation, no device logic. If tempted to "process a little" in the frontend, that code belongs to `packages/core` or python.
- Backend access ONLY through `window.platform` (typed by `PlatformApi` from `@platform/shared-types`). Never import electron or node modules.
- Every push subscription stores its unsubscribe function and calls it in `onUnmounted`. Device views must `unwatch` on leave — never leave an orphan live poll on a serial bus.
- State shared across islands goes in a Pinia store (`src/stores/`) subscribed once to push events; components read the store.

## Execution Steps

1. If the data needed is not in `PlatformApi`, STOP and run the `add-rpc-method` skill first.
2. Create the `.vue` with `<script setup lang="ts">`; import payload types from `@platform/shared-types` (type-only imports).
3. Wire it into `App.vue` (or the router once it exists).
4. Typecheck: `pnpm --filter @platform/frontend build`.

## Output Contract

Island file path, store changes (if any), and passing frontend build.
