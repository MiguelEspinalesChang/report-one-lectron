---
name: add-rpc-method
description: "Trigger: new RPC method, sidecar command, IPC channel, push event, nuevo metodo RPC. Wire a command or event across shared-types, core, electron and python."
license: Apache-2.0
metadata:
  author: MiguelEspinalesChang
  version: "1.0"
---

## Activation Contract

Use when adding any command (renderer → python) or push event (python → renderer). Never add a method in a single layer — the chain always crosses processes.

## Hard Rules

- `packages/shared-types/src/index.ts` is the single source of truth. Add the `RpcMethods` entry (and `IpcChannels` + `PlatformApi` if the renderer is involved) plus DTOs FIRST.
- Python mirrors method name strings manually: keep the `_handlers()` dict keys in `apps/python-service/rpc/server.py` in sync with `RpcMethods` values.
- Validate at every boundary: zod in core services, explicit param checks in python (`ValueError` → INVALID_PARAMS).
- Electron handlers stay one-line delegations to core. Zero logic in `handlers.ts` or `preload/bridge.ts`.
- Massive data never crosses stdio/IPC — only summaries, states and job progress.

## Execution Steps — command (request/response)

1. shared-types: `RpcMethods` entry + params/result DTOs; if UI-facing, also `IpcChannels` + `PlatformApi` method.
2. core: method on the owning service calling `this.bridge.request(...)` with zod-parsed params.
3. electron: `ipcMain.handle` one-liner in `main/handlers.ts`; expose in `preload/bridge.ts`.
4. python: async handler registered in `_handlers()` in `rpc/server.py`.
5. Tests: dispatch case in `apps/python-service/tests/` + integration case in `packages/core/src/python-bridge/client.spec.ts`.

## Execution Steps — push event (python → UI)

1. shared-types: notification name in `RpcMethods`, channel in `IpcChannels`, payload DTO, `PlatformApi.onX` subscription.
2. python: emit with `self.notify(method, params)`.
3. electron: add the method→channel mapping in `main/events.ts` `channelByMethod`; add `onX` in preload (must return an unsubscribe function).
4. UI: consume from a Pinia store subscribed once, not per-component listeners.

## Output Contract

List every layer touched. `pnpm build` and `pnpm test` must pass before done.
