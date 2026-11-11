# Feature: frontend-alpha-acceptance

**Objetivo:** Cerrar el plan del alfa del frontend: terminar el gap restante (§6.4 desactivación de usuarios), reconciliar el documento del plan con el código y ejecutar el checklist de aceptación de §8.
**Plan (fuente de verdad del alcance):** `docs/features/in-progress/frontend-alpha-requirements.md`
**Rama:** `feature/frontend-alpha-acceptance` (desde `develop` @ 38d153c)
**Problema / por qué:** Las fases 0-8 están implementadas, pero R2.4 no tiene acción (no existe el caso de uso en el backend), el documento del plan tiene checkboxes y referencias desactualizados, y el checklist de §8 nunca se ejecutó de punta a punta.
**Restricciones:** reglas hexagonales (`docs/HEXAGONAL.md`), handlers de Electron de una línea, zod en la frontera IPC, i18n EN+ES, commits solo con confirmación explícita del usuario (regla del proyecto).
**TDD:** estricto (configuración de la sesión). Runner: `pnpm test` (vitest core/electron + pytest); puntual: `pnpm --filter @platform/core exec vitest run`.
**Estrategia de entrega:** ask-on-risk. Pronóstico ~300-400 líneas de autoría; real hasta ahora ~221 (T1) + docs.

## Decisiones

- La desactivación es un toggle reversible (`setActive(userId, isActive)`), no una acción de un solo sentido — un admin puede reactivar a un usuario.
- Un usuario no puede desactivar su propia cuenta (evita dejar bloqueada la única sesión de admin). Se aplica en core mediante el `AuthSession` inyectado; la UI deshabilita el toggle en la fila propia.

## Tareas

- [x] T1 — §6.4 `users:setActive`: caso de uso en core (+ guard de autodesactivación, tests) → contrato en shared-types → handler IPC + preload → acción en `useUsersStore` + toggle en `UsersView` + i18n EN/ES. Ruta: delegada (trigger de writer: 2+ archivos no triviales en 3 paquetes). Evidencia: RED 5 fallando (`setActive is not a function`) → GREEN; core 97 ✓, electron 23 ✓, pytest 50 ✓, lint ✓, build ✓ (el padre volvió a correr core: 97 ✓). ~221 líneas de autoría, 18 archivos.
- [x] T2 — Reconciliar el documento del plan: marcar los checkboxes de las Fases 0/1, corregir el `rebuild:node` obsoleto en el cierre de la Fase 6, documentar que `useLiveStore` no se creó (el estado en vivo es local al componente en `DeviceLiveView`), marcar §6.4 como hecho. Ruta: inline (un solo archivo de docs). Evidencia: todo aplicado; nota de F2 verificada contra `DeviceLiveView.vue`; §8 "build y lint pasan" marcado.
- [x] T4 — R2.5 / §6.5 `users:resetPassword`: un admin define una contraseña temporal para un usuario `operator` o `viewer`; el destinatario queda con `mustChangePassword = true` y debe cambiarla en el próximo login. El caso de uso en core rechaza destinatarios con rol `admin` (`CannotResetAdminPasswordError`) y aplica la política de contraseñas (mínimo 8); la UI agrega una acción "Reset password" por fila (oculta en filas de admin) con un modal (`AppPasswordInput` + confirmación) → contrato en shared-types + zod → handler IPC de una línea + preload → acción en `useUsersStore` → i18n EN/ES. TDD: tests del servicio (operator ok, viewer ok, admin rechazado, contraseña débil, usuario inexistente) + integración (login con contraseña temporal → `mustChangePassword: true`). Ruta: delegada (trigger de writer: 2+ archivos no triviales en 3 paquetes). Evidencia: RED 5 fallando (`resetPassword is not a function`) → GREEN; core 103 ✓, electron 23 ✓, pytest 50 ✓, lint ✓, build ✓ (el padre volvió a correr core: 103 ✓). Se reutilizó `UserRepository.updatePasswordHash(id, hash, true)` — sin método nuevo en el puerto. ~316 líneas de autoría.
- [x] T5 — Generador de contraseñas seguras en los modales de Usuarios (crear usuario + resetear contraseña): un botón "Generate" completa contraseña + confirmación con una contraseña aleatoria, de longitud seleccionable 8–20 (por defecto 16), usando `crypto.getRandomValues` con muestreo sin sesgo (por rechazo), garantizando al menos una minúscula, una mayúscula, un dígito y un símbolo, excluyendo caracteres ambiguos (`0O1lI`), y luego mezclada (Fisher–Yates). Utilidad de conveniencia puramente de UI en `apps/frontend` (sin regla de negocio; la política del backend sigue siendo mínimo 8 y es la autoridad). El valor generado se muestra para que el admin pueda entregarlo. Agrega vitest a `apps/frontend` para la utilidad. Ruta: delegada (trigger de writer: util + spec + componente + vista + i18n). Evidencia: RED (módulo inexistente) → GREEN 11/11; core 103 ✓, electron 23 ✓, frontend 11 ✓, pytest 50 ✓, lint ✓, build ✓ (el padre volvió a correr frontend: 11 ✓, revisó la utilidad). Ampliación de alcance aceptada: el modal de crear usuario ganó un campo de confirmación de contraseña (necesario para que Generate complete ambos campos); `AppPasswordInput` recibió la prop opcional `revealed`; botón Copy opcional. ~500 líneas de autoría (por encima de la heurística de 400: util+spec+2 modales+i18n; no se dividió artificialmente).
- [ ] T5b — Corrección de RDD (linaje `review-95812b0812fc444c`, hallazgos `R1-setActive-no-authz`, `R1-resetPassword-no-authz`, CRÍTICOS): `UserManagementService` en core exige una sesión autenticada con `users.manage` para `setActive` y `resetPassword` (`NotAuthenticatedError` / `PermissionDeniedError`). El usuario aprobó el 2026-09-24; cambia la decisión de §5 "enforcement solo en la UI" para estas operaciones. Presupuesto ≤200 líneas (planificadas 150). Ruta: delegada. Evidencia: RED 5 fallando (tests de authz resolviendo) → GREEN; core 108 ✓, electron 23 ✓, frontend 11 ✓, pytest 50 ✓, lint ✓, build ✓ (el padre volvió a correr core: 108 ✓, revisó el guard). 176 líneas de autoría, 8 archivos. Sin commitear — a la espera de confirmación del usuario.
- [ ] T6 — Enforcement de permisos en el backend para las operaciones restantes de gestión de usuarios (`createUser`, `assignRole`) y revisión de §5 para el resto de la superficie IPC. Gap preexistente (no introducido por esta rama) encontrado por la lente de riesgo de RDD; fuera del alcance congelado de la corrección.
- [ ] T3 — Aceptación de §8: la parte automatizada (`pnpm lint`, `pnpm test`, `pnpm build`) se hizo en T1; recorrida manual de la UI con los 3 roles (incluido el nuevo toggle de desactivación) a cargo del usuario. Ruta: inline (checks por acción).

## Criterios de aceptación

- [x] Un admin puede desactivar/reactivar a otro usuario; un usuario desactivado recibe `InactiveUserError` al hacer login; la autodesactivación se rechaza. (Probado con tests unitarios + de integración; el toggle de la UI queda pendiente de verificación manual en T3.)
- [x] `pnpm lint`, `pnpm test`, `pnpm build` en verde.
- [ ] Checklist de §8 completamente marcado (ítems manuales confirmados por el usuario).

## Progreso / evidencia

- T4 agregada a pedido del usuario el 2026-09-24 (el admin resetea contraseñas de operator/viewer).
- `auth-service.spec.ts` necesitó un `setActive` no-op en su propio repositorio falso (puerto ampliado).
- División de commits (el usuario eligió la opción A): T1+T4 comparten la mayoría de los archivos, así que fueron en un solo commit; las partes de T5 se quitaron de `UsersView.vue`/i18n para el commit 1 y se restauraron después. Se verificó que el árbol final es idéntico al estado previo a la división. Cada commit se compiló/testeó/linteó de forma aislada (stash `--keep-index`).
- Los textos en ES de los errores nuevos se cambiaron de voseo a español neutro ("No es posible …") para coincidir con `es.json`.
- Gotcha de reinicio: los handlers IPC/preload nuevos requieren reiniciar `pnpm dev` por completo (el HMR de Vite solo recarga el renderer).

## Commits

- `c44917a` feat(users): ✨ activar/desactivar y resetear contraseña de usuarios — T1 + T4. build 7/7, core 103, electron 23, pytest 50, lint ✓.
- `84ce0b7` feat(frontend): ✨ generador de contraseñas seguras en los modales de usuarios — T5. build 7/7, core 103, electron 23, frontend 11, pytest 50, lint ✓.
- commit de docs — T2 + este documento.

## Próximo paso

T3: el usuario ejecuta la recorrida manual de §8 con los 3 roles e informa los resultados.
