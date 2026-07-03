---
name: add-rpc-method
description: "Trigger: new RPC method, sidecar command, IPC channel, push event, nuevo metodo RPC, nuevo evento. Cablea un comando o evento a través de shared-types, core, electron y python."
license: Apache-2.0
metadata:
  author: MiguelEspinalesChang
  version: "1.0"
---

## Contrato de activación

Usar al agregar cualquier comando (renderer → python) o evento push (python → renderer). Nunca agregar un método en una sola capa — la cadena siempre cruza procesos.

## Reglas duras

- `packages/shared-types/src/index.ts` es la única fuente de verdad. Agregá PRIMERO la entrada en `RpcMethods` (y en `IpcChannels` + `PlatformApi` si el renderer participa) más los DTOs.
- Python replica los strings de nombres de método manualmente: mantené las claves del dict `_handlers()` en `apps/python-service/rpc/server.py` sincronizadas con los valores de `RpcMethods`.
- Validá en cada frontera: zod en los servicios de core, checks explícitos de params en python (`ValueError` → INVALID_PARAMS).
- Los handlers de Electron son delegaciones de una línea a core. Cero lógica en `handlers.ts` o `preload/bridge.ts`.
- Los datos masivos nunca cruzan stdio/IPC — solo resúmenes, estados y progreso de jobs.

## Pasos — comando (request/response)

1. shared-types: entrada en `RpcMethods` + DTOs de params/resultado; si llega a la UI, también `IpcChannels` + método en `PlatformApi`.
2. core: método en el servicio dueño que llama `this.bridge.request(...)` con params parseados por zod.
3. electron: one-liner `ipcMain.handle` en `main/handlers.ts`; exponer en `preload/bridge.ts`.
4. python: handler async registrado en `_handlers()` de `rpc/server.py`.
5. Tests: caso de dispatch en `apps/python-service/tests/` + caso de integración en `packages/core/src/python-bridge/client.spec.ts`.

## Pasos — evento push (python → UI)

1. shared-types: nombre de la notificación en `RpcMethods`, canal en `IpcChannels`, DTO del payload y suscripción `PlatformApi.onX`.
2. python: emitir con `self.notify(method, params)`.
3. electron: agregar el mapeo método→canal en `channelByMethod` de `main/events.ts`; agregar `onX` en el preload (debe devolver una función de desuscripción).
4. UI: consumir desde un store de Pinia suscrito una sola vez, no listeners por componente.

## Contrato de salida

Listar cada capa tocada. `pnpm build` y `pnpm test` deben pasar antes de dar por terminado.
