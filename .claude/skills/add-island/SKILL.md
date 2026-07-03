---
name: add-island
description: "Trigger: new island, new view, new screen, nueva isla, nueva vista, nueva pantalla. Crea una isla Vue conectada al platform bridge, solo UI."
license: Apache-2.0
metadata:
  author: MiguelEspinalesChang
  version: "1.0"
---

## Contrato de activación

Usar al crear o extender una vista de UI en `apps/frontend`. Las islas pintan y reaccionan — nunca deciden.

## Reglas duras

- Las islas viven en `apps/frontend/src/islands/<Area>/<Nombre>.vue`, PascalCase, nombres de componente de más de una palabra.
- Solo UI: sin agregaciones, sin validación de CSV, sin lógica de dispositivos. Si aparece la tentación de "procesar tantito" en el frontend, ese código pertenece a `packages/core` o a python.
- Acceso al backend SOLO a través de `window.platform` (tipado por `PlatformApi` de `@platform/shared-types`). Nunca importar módulos de electron ni de node.
- Toda suscripción push guarda su función de desuscripción y la llama en `onUnmounted`. Las vistas de dispositivo deben hacer `unwatch` al salir — nunca dejar un polling live huérfano en un bus serial.
- El estado compartido entre islas va en un store de Pinia (`src/stores/`) suscrito una sola vez a los eventos push; los componentes leen el store.
- Patrón contenedor/presentacional (`docs/HEXAGONAL.md` §4): la isla es el CONTENEDOR (habla con `window.platform` y stores); el markup reutilizable va en componentes PRESENTACIONALES (solo `props` + `emits`, sin acceso a `window.platform` ni stores) que se mueven a `packages/ui-components` cuando se reutilizan.

## Pasos

1. Si el dato que necesitás no está en `PlatformApi`, FRENÁ y ejecutá primero el skill `add-rpc-method`.
2. Creá el `.vue` con `<script setup lang="ts">`; importá los tipos del payload desde `@platform/shared-types` (imports solo de tipos).
3. Conectala en `App.vue` (o en el router cuando exista).
4. Typecheck: `pnpm --filter @platform/frontend build`.

## Contrato de salida

Ruta del archivo de la isla, cambios en stores (si hubo) y build del frontend pasando.
