# Requerimientos del frontend — Fase Alfa avanzada

**Estado:** Fases 0-8 implementadas — pendiente la pasada final del checklist de aceptación (§8) con los 3 roles
**Alcance:** `apps/frontend` (renderer Vue) + los gaps de IPC mínimos que el alfa necesita
**Documentos normativos:** `docs/ARCHITECTURE.md`, `docs/HEXAGONAL.md`, `docs/features/vue-backend-integration.md`
**Sistema de diseño:** Vue 3 + Tailwind CSS v4 + [Preline UI](https://preline.co/docs/) (ver F6)

Este documento define QUÉ debe tener el frontend para una fase alfa avanzada, basado exclusivamente en lo que el backend ya soporta hoy. El objetivo del alfa: un usuario puede iniciar sesión, administrar usuarios, cargar el catálogo completo (marcas → modelos con mapa de registros → dispositivos), ver lecturas en vivo del simulador y consultar historial de telemetría — todo offline, con permisos aplicados y en EN/ES.

---

## 1. Qué se puede construir HOY vs qué está bloqueado

La superficie IPC actual (`window.platform`, tipada por `PlatformApi` en `packages/shared-types`) habilita la mayoría del alfa sin tocar backend. Solo dos features requieren cerrar gaps de IPC (ver §6).

| Área | Estado backend | Bloqueante |
| --- | --- | --- |
| Login + gate `mustChangePassword` | ✅ `auth.*` completo | — |
| Gestión de usuarios (crear/listar/asignar rol) | ✅ `users.*` completo | — |
| Catálogo: marcas | ✅ CRUD completo | — |
| Catálogo: modelos + editor de mapa de registros | ✅ CRUD completo | — |
| Catálogo: dispositivos (4 transportes, incl. `csv`) | ✅ CRUD completo | — |
| Vista en vivo de dispositivo | ✅ `devices.watch/onReading/onStatus` | Datos placeholder (ver §6.3) |
| Historial de telemetría (gráfico) | ⚠️ existe en core, sin IPC | Gap §6.1 |
| Disparar poll simulado desde la UI | ⚠️ existe en core, sin IPC | Gap §6.2 |
| Importación CSV | 🔴 no implementado en Python | Fuera del alfa |
| Reportes PDF/Excel | 🔴 no implementado en Python | Fuera del alfa |
| Configuración de la app | 🔴 sin IPC ni casos de uso | Fuera del alfa |

---

## 2. Fundaciones (prerequisito de todos los módulos)

El frontend actual es un esqueleto: `App.vue` plano con dos islas demo, sin router, sin stores, sin auth. Estas fundaciones van PRIMERO.

### F1 — Router y guards

- Instalar `vue-router` y definir rutas por área: `login`, `change-password`, `dashboard`, `catalog` (marcas/modelos/dispositivos), `devices/:id/live`, `users`.
- **Guard de autenticación:** sin sesión (`platform.auth.getSession()` → `null`) toda ruta redirige a `login`.
- **Guard de `mustChangePassword`:** si la sesión tiene `mustChangePassword: true`, la ÚNICA ruta accesible es `change-password`. Es un requisito explícito de `vue-backend-integration.md` §4 (el usuario seed es `admin`/`admin` con cambio forzado).
- **Guard de permisos:** cada ruta declara el permiso requerido en `meta` (ver tabla §5); sin el permiso se redirige al dashboard.

### F2 — Stores Pinia

Pinia está instalado y registrado pero sin uso. Stores mínimos:

| Store | Estado que posee | Fuente |
| --- | --- | --- |
| `useSessionStore` | `SessionUserDto \| null`, helpers `hasPermission(code)`, acciones `login/logout/changePassword/restore` | `platform.auth.*` |
| `useCatalogStore` | marcas, modelos, dispositivos; acciones CRUD que delegan en `platform.catalog.*` y refrescan | `platform.catalog.*` |
| `useUsersStore` | lista de usuarios, acciones `create/assignRole` | `platform.users.*` |
| `useLiveStore` | lecturas y estado por dispositivo observado, suscripciones activas | `platform.devices.*` |

Regla de `docs/HEXAGONAL.md`: los stores solo invocan `window.platform`, escuchan y guardan — cero lógica de negocio (la validación real vive en core/python; la UI solo pre-valida para UX).

### F3 — Shell de aplicación

- **Layout tipo dashboard con sidebar lateral** (decisión 2026-07-10, referencia: template Admin Dashboard de Preline): sidebar fija a la izquierda con marca + navegación vertical (Dashboard, Catálogo, Dispositivos, Usuarios; ítems visibles según permisos §5), topbar con breadcrumbs + salud del sidecar + `LanguageSwitcher` + menú de usuario, y área de contenido. Las vistas de auth (login, change-password) NO usan el shell — layout centrado propio.
- **Responsive**: por debajo de `lg` la sidebar colapsa a off-canvas con botón hamburguesa en la topbar (componente Sidebar/Offcanvas de Preline). El contenido nunca queda inaccesible en el tamaño mínimo de ventana.
- **Tamaño mínimo de ventana Electron**: `minWidth: 1024`, `minHeight: 700` (default `1280×800`) en el `BrowserWindow` — el layout se valida contra ese mínimo.
- Header con usuario actual (`displayName`, `roleName`), botón de logout y `LanguageSwitcher` (ya existe).
- **Breadcrumbs** en toda vista interna: derivados de la jerarquía de rutas (`route.meta` + `route.matched`), renderizados con `AppBreadcrumb` (base Preline). El router es la única fuente de verdad — las vistas NO arman breadcrumbs a mano; declaran su etiqueta (clave i18n) en `meta.breadcrumb`.
- Indicador de salud del sidecar (reutilizar `SystemStatus`): ping periódico y estado visible cuando el sidecar no responde.
- Mantener el patrón de islas existente (`src/islands/<Área>/`): las carpetas `Users/`, `Inventory/`, `Settings/`, `Imports/`, `Reports/` ya existen como placeholders.

### F4 — Manejo de errores

Los errores llegan como promesas rechazadas desde el main. Requisitos:

- Un helper/composable único (`useApiCall` o similar) que capture el rechazo, lo mapee a una clave i18n y lo muestre (toast o inline según el caso).
- Errores de dominio conocidos con mensaje específico: `InvalidCredentialsError`, `InactiveUserError`, `BrandInUseError`, `MeterModelInUseError`, `DeviceNotFoundError`, `TransportMismatchError`, `InvalidConnectionError`.
- Error genérico de fallback + estado visible cuando `'platform' in window` es falso (ya existe en `App.vue`, se conserva).
- Estados de carga y vacío en TODA lista (el patrón ya está en `DeviceLive.vue`: `devices.empty`).

### F5 — i18n

- Todo texto visible pasa por `t('...')` y se agrega en `en.json` Y `es.json` (regla de CLAUDE.md). Hoy solo existen las claves `app`, `system`, `devices`, `language` — el alfa agrega los namespaces `auth`, `users`, `catalog`, `live`, `telemetry`, `errors`, `nav`, `common`.
- La persistencia de locale ya funciona (`setLocale` + localStorage) — no tocar.

### F6 — Estilos y sistema de componentes (Preline UI)

El sistema de diseño del alfa es **Vue 3 + Tailwind CSS v4 + Preline UI** (https://preline.co/docs/). Preline aporta los componentes interactivos (modales, dropdowns, selects, tabs, toasts) sobre las mismas utilidades Tailwind que ya usa el proyecto — verificado: Preline v4.x soporta Tailwind v4 y tiene guía oficial para Vue 3 + Vite.

**Integración (según la guía oficial de Vue):**

- Dependencias: `preline` + `@tailwindcss/forms` (dev).
- En `src/assets/main.css` (única entrada CSS del proyecto — la regla "sin CSS global fuera de `main.css`" se mantiene intacta):

  ```css
  @import 'tailwindcss';
  @import 'preline/variants.css';
  @source "../../node_modules/preline/dist/*.js";
  @plugin "@tailwindcss/forms";
  ```

- Carga del JS: `import('preline/dist/index.js')` después de `app.mount()` en `main.ts`.
- Tipado: declarar `window.HSStaticMethods: IStaticMethods` (de `preline/dist`) en `src/env.d.ts`, junto a la declaración existente de `window.platform`.
- **Re-init obligatorio tras cada navegación** (los componentes de Preline se inicializan por escaneo del DOM): en el router de F1, `router.afterEach(() => setTimeout(() => window.HSStaticMethods.autoInit(), 100))`. Sin esto, dropdowns/modales quedan muertos al cambiar de ruta.

**Jerarquía de estilos actualizada:** componente Preline (markup + clases de la doc) → utilidades Tailwind con los tokens `@theme` existentes (accent/slate) → clases compartidas `.island`/`.btn`/`.btn-primary` → `<style module>` para lo específico. Los tokens de color del proyecto se aplican SOBRE el markup de Preline (reemplazar sus `blue-*` por `accent-*`); no se adoptan paletas de la doc tal cual.

**Regla de envoltura:** los componentes presentacionales del proyecto (§4) ENVUELVEN el markup de Preline — las islas nunca copian markup de Preline directo. Cada patrón de UI se implementa UNA vez como componente propio y se reutiliza. Catálogo de componentes propios del alfa y su base Preline:

| Componente propio | Base Preline | Usado por |
| --- | --- | --- |
| `AppTable` (columnas por slot, vacío/cargando) | Tables | R2.1, R3.1, R4.1, R5.1 |
| `AppModal` / `ConfirmDialog` | Overlay/Modal (`HSOverlay`) | Borrados R3.2, R4.6, R5.5; advertencia R4.5 |
| `AppToast` (feedback de éxito/error de F4) | Toasts | Todos los módulos |
| `AppInput` / `AppPasswordInput` | Input + `@tailwindcss/forms` | R1, R2.2, R3, R4, R5 |
| `AppSelect` (roles, marcas, modelos, transporte, datatype) | Select (`HSSelect`) | R2.2, R2.3, R4.3, R5.2 |
| `AppTabs` (secciones del catálogo) | Tabs (`HSTabs`) | §Inventory: marcas/modelos/dispositivos |
| `AppDropdown` (menú de usuario, acciones por fila) | Dropdown (`HSDropdown`) | Shell F3, tablas |
| `AppBreadcrumb` (jerarquía de la ruta actual) | Breadcrumb | Shell F3, toda vista interna |
| `AppToggle` (enabled del dispositivo, mustChangePassword) | Switch/Toggle | R2.2, R5.4 |
| `AppBadge` (estado conectado/degradado/desconectado, rol, transporte) | Badge | R2.1, R5.1, R6.2 |
| `AppEmptyState` | — (composición propia con `.island`) | Toda lista vacía (F4) |

El editor de mapa de registros (R4.3) se compone con estas piezas (`AppTable` editable + `AppSelect` + `AppInput`); no existe un componente Preline "editor", es composición propia.

---

## 3. Requerimientos por módulo

### R1 — Autenticación

| Req | Detalle |
| --- | --- |
| R1.1 | Pantalla de login (username + password) → `platform.auth.login(dto)`. Error genérico ante credenciales inválidas (el backend ya no distingue usuario/contraseña por diseño anti-enumeración). |
| R1.2 | Al montar la app, `restore()`: `getSession()` para rehidratar la sesión (vive en memoria del main — sobrevive al reload del renderer, muere con la app). |
| R1.3 | Pantalla de cambio de contraseña → `platform.auth.changePassword({ userId, currentPassword, newPassword })`. Mínimo 8 caracteres, confirmación repetida en la UI. Al completarse, `mustChangePassword` queda en falso y se libera la navegación. |
| R1.4 | Logout → `platform.auth.logout()`, limpiar stores y volver a `login`. |
| R1.5 | Flujo del primer arranque: login con `admin`/`admin` → gate de cambio de contraseña → dashboard. Este flujo es el criterio de humo del alfa. |

### R2 — Gestión de usuarios (requiere `users.manage`)

| Req | Detalle |
| --- | --- |
| R2.1 | Tabla de usuarios (`platform.users.list()`): username, displayName, rol, activo, debe-cambiar-contraseña, fecha de creación (`createdAt` es epoch ms — formatear por locale). |
| R2.2 | Alta de usuario (`platform.users.create(dto)`): username, contraseña (min 8), displayName, rol (los 3 roles del sistema: `admin`, `operator`, `viewer`), checkbox `mustChangePassword` (default activado). |
| R2.3 | Cambio de rol (`platform.users.assignRole({ userId, roleId })`). |
| R2.4 | Desactivar usuario: NO existe caso de uso en backend (solo el campo `isActive`). Mostrar el estado, sin acción. Marcado como gap deseable en §6.4. |

### R3 — Catálogo: marcas (requiere `devices.manage`; solo lectura con `devices.view`)

| Req | Detalle |
| --- | --- |
| R3.1 | Lista + alta (`brands.create({ name })`, 1–128 chars, único) + renombrar (`brands.rename`). |
| R3.2 | Borrado con confirmación; si tiene modelos el backend rechaza con `BrandInUseError` → mensaje claro ("tiene N modelos asociados" se puede derivar de `models.listByBrand`). |

### R4 — Catálogo: modelos y editor de mapa de registros (requiere `devices.manage`)

El mapa de registros es el contrato central del catálogo — el editor es la pieza de UI más compleja del alfa.

| Req | Detalle |
| --- | --- |
| R4.1 | Lista de modelos por marca (`models.listByBrand`) y global (`models.list`). |
| R4.2 | Alta de modelo: marca, nombre, notas, mapa de registros (`models.create`). |
| R4.3 | Editor de mapa: tabla editable de registros con columnas `address` (0–65535), `function` (`holding`/`input`), `metric` (único dentro del mapa), `datatype` (7 opciones), `wordOrder`, `scale` (default 1), `unit`. Mínimo 1 registro; `version` fija en `1` (literal, no editable). |
| R4.4 | Validación en la UI espejando el schema zod ANTES de enviar (métricas duplicadas, address fuera de rango) — el backend re-valida en la frontera, la UI solo mejora la UX del error. |
| R4.5 | Edición del mapa de un modelo existente (`models.updateMap`) con advertencia: cambiar `metric` afecta cómo se registran lecturas futuras en `telemetry.db`. |
| R4.6 | Borrado con confirmación; `MeterModelInUseError` si tiene dispositivos. |
| R4.7 | El modelo seed `SIM-100` (marca `Simulated`, 8 métricas) debe verse correctamente — es el fixture de prueba del alfa. |

### R5 — Catálogo: dispositivos (requiere `devices.manage`; solo lectura con `devices.view`)

| Req | Detalle |
| --- | --- |
| R5.1 | Lista de dispositivos con nombre, modelo, transporte, habilitado, intervalo de polling. |
| R5.2 | Alta/edición con **formulario condicional por transporte** (requisito explícito de `vue-backend-integration.md` §3): `serial` → vid/pid/serialNumber?/baudrate/parity/timeoutMs; `tcp` → host/puerto (1–65535)/timeoutMs; `simulated` y `csv` → sin campos de conexión (`{}`). |
| R5.3 | Campos comunes: `slaveId` (0–247), `pollingIntervalS`, `enabled`. |
| R5.4 | Toggle habilitar/deshabilitar (`devices.enable`) directo desde la lista. |
| R5.5 | Borrado con confirmación (`devices.delete`). |
| R5.6 | El dispositivo seed `Test simulator` (simulado, slaveId 1) debe funcionar de punta a punta con R6. |

### R6 — Vista en vivo de dispositivo (requiere `telemetry.view`)

| Req | Detalle |
| --- | --- |
| R6.1 | Desde la lista de dispositivos, acción "ver en vivo" → `devices.watch(deviceId)`; al salir de la vista, `unwatch` + **desuscribir los callbacks** (los `onReading`/`onStatus` devuelven la función de unsubscribe — llamarla en unmount, patrón ya presente en `DeviceLive.vue`). |
| R6.2 | Estado de conexión visible mapeando `DeviceStatus.state`: `connected` / `degraded` / `disconnected`. |
| R6.3 | Lecturas en vivo: últimas N por métrica con timestamp formateado, y un gráfico simple de la ventana reciente (los datos en vivo son efímeros — NO persisten; el historial persistido llega por R7). |
| R6.4 | Advertencia conocida: hoy el push de `device.watch` emite valores placeholder (`random.uniform`, métrica fija `voltage`) — la UI se construye contra el contrato `DeviceReading`, no contra esos valores. El fix es backend (§6.3) y no cambia la UI. |

### R7 — Historial de telemetría (requiere `telemetry.view`) — **bloqueado por gap §6.1**

| Req | Detalle |
| --- | --- |
| R7.1 | Vista de historial por dispositivo + métrica: selector de métrica (derivado del mapa de registros del modelo), rango temporal (presets: última hora / 24 h / 7 días + rango custom) y `bucketMs` acorde al rango. |
| R7.2 | Gráfico de serie temporal con `TelemetryPoint[]` (`bucket`, `min`, `max`, `avg`, `count`): línea de `avg` con banda min–max. |
| R7.3 | Estado vacío explícito: `getHistory` devuelve `[]` si `telemetry.db` aún no existe o no hay datos en el rango — no es un error. |
| R7.4 | Librería de gráficos: elegir UNA liviana y usarla para R6.3 y R7.2 (mismo componente presentacional de gráfico). |

### R8 — Disparo de poll simulado (requiere `devices.manage`) — **bloqueado por gap §6.2**

| Req | Detalle |
| --- | --- |
| R8.1 | En dispositivos con transporte `simulated`: acción "generar datos" que dispara `acquisition.simulatedPoll` con el mapa de registros del modelo y `ticks` configurable (default 10, máx 1000). |
| R8.2 | Mostrar el `SimulatedPollResult` (`inserted`, `ignored`, `ticks`, `metrics`) al terminar. Es la herramienta para alimentar R7 con datos reales durante el alfa. |

---

## 4. Estructura de código esperada

Según `docs/HEXAGONAL.md` (container-island vs presentacional) y las carpetas ya creadas:

```
apps/frontend/src/
├── router/            # rutas + guards (F1)
├── stores/            # session, catalog, users, live (F2)
├── composables/       # useApiCall, usePermission, etc. (F4)
├── islands/           # containers: hablan con window.platform
│   ├── Auth/          #   login, change-password
│   ├── Dashboard/     #   SystemStatus (existe) + resumen
│   ├── Inventory/     #   marcas, modelos, editor de mapa
│   ├── Devices/       #   CRUD de dispositivos (vista dedicada `/devices`, decisión de
│   │                  #   UX 2026-07-17 — ya no es un tab de Catálogo) + DeviceLive
│   │                  #   (existe) + historial; entrada propia en el sidebar
│   └── Users/         #   tabla + alta + rol
└── components/        # presentacionales puros: reciben props, emiten eventos
                       #   (LanguageSwitcher existe; sumar los wrappers Preline de F6:
                       #    AppTable, AppModal, AppToast, AppSelect, AppTabs, etc. + gráfico)
```

Regla no negociable (`docs/ARCHITECTURE.md` §11): Vue solo invoca, escucha y pinta. Ninguna isla ni store contiene lógica de negocio.

---

## 5. Permisos → visibilidad

La sesión trae `permissionCodes: string[]`. La UI oculta lo que el usuario no puede hacer (el backend NO re-chequea permisos por IPC hoy — la UI es la única capa de enforcement en el alfa, dejarlo documentado).

| Permiso | Habilita en la UI |
| --- | --- |
| `users.manage` | Sección Usuarios completa |
| `devices.manage` | Alta/edición/borrado en catálogo, toggle enabled, poll simulado (R8) |
| `devices.view` | Catálogo en solo-lectura, lista de dispositivos |
| `telemetry.view` | Vista en vivo (R6) e historial (R7) |
| `reports.generate` / `reports.view` | Nada en el alfa (reportes fuera de alcance) — no mostrar sección |
| `settings.manage` | Nada en el alfa — no mostrar sección |

Roles seed: `admin` (todo), `operator` (devices + telemetry + reports), `viewer` (solo vistas). Verificar con los tres roles como parte de la aceptación.

---

## 6. Gaps de backend que el alfa avanzado necesita

Trabajo FUERA de `apps/frontend`, mínimo y acotado. Cada método nuevo sigue `.claude/skills/add-rpc-method/SKILL.md` (~5 archivos, 3 procesos).

| # | Gap | Qué falta | Habilita |
| --- | --- | --- | --- |
| 6.1 | `telemetry:getHistory` | Canal IPC + namespace `PlatformApi.telemetry` + preload. `TelemetryService.getHistory` ya existe en core con sus DTOs (`TelemetryHistoryParams`, `TelemetryPoint`). | R7 |
| 6.2 | `acquisition:simulatedPoll` | Canal IPC + namespace `PlatformApi.acquisition` + preload. `AcquisitionService.runSimulatedPoll` ya existe; el RPC a Python ya existe. | R8 |
| 6.3 | Live watch real | Reemplazar `_emit_readings` placeholder (`random.uniform`, métrica fija) por `SimulatedReader` con el mapa de registros del dispositivo. Ya listado como pendiente de Fase 4. | R6 con datos coherentes |
| 6.4 | `users:deactivate` (deseable, no bloqueante) | Caso de uso `deactivateUser` + IPC. El campo `isActive` ya existe. | R2.4 completo |

---

## 7. Fuera de alcance del alfa

Explícitamente NO entra, porque el backend no existe o es placeholder:

- **Importación CSV** — `apps/python-service/imports/` vacío; sin parser, sin `import.progress`, sin IPC. La carpeta `islands/Imports/` queda como placeholder.
- **Reportes PDF/Excel** — `apps/python-service/reports/` vacío; sin RPC ni IPC.
- **Configuración de la app** — tabla `app_settings` existe pero sin casos de uso ni IPC.
- **Scheduler de polling periódico** — no hay loop en Python; los datos del alfa se generan con R8.
- **Adquisición Modbus real (serial/tcp)** — sin transportes pymodbus; los formularios de R5.2 se construyen igual (el catálogo sí los persiste).
- **Downsampling** (`readings_1m`/`readings_1h`) — el historial agrega on-the-fly sobre `readings`.
- **Empaquetado/instalador** — cubierto por `docs/features/installer-packaging.md`.

---

## 8. Criterios de aceptación del alfa

Recorrido de humo completo, con la app corriendo vía `pnpm dev`:

- [ ] Arranque limpio: login con `admin`/`admin` → forzado a cambiar contraseña → dashboard.
- [ ] Con `mustChangePassword: true` es imposible navegar a otra ruta (guard F1).
- [ ] Crear un usuario `operator` y otro `viewer`; verificar que cada uno ve solo sus secciones (§5).
- [ ] Crear marca → modelo con mapa de registros de 3+ métricas → dispositivo `simulated` apuntando a ese modelo.
- [ ] Crear un dispositivo `tcp` y uno `csv` — los formularios condicionales validan según transporte.
- [ ] Intentar borrar una marca con modelos → error `BrandInUseError` legible, la marca sigue viva.
- [ ] Ver el dispositivo seed `Test simulator` en vivo: estado `connected`, lecturas fluyendo, `disconnected` al salir; sin listeners colgados tras desmontar.
- [ ] (Con gap 6.2) Disparar poll simulado de 100 ticks → resumen `inserted/ignored` visible.
- [ ] (Con gap 6.1) Historial del dispositivo seed: gráfico min/avg/max del rango con datos; estado vacío correcto en un rango sin datos.
- [ ] Cambiar de idioma EN↔ES en cualquier pantalla: todo texto visible cambia; sin claves faltantes en consola.
- [ ] Componentes Preline vivos tras navegar entre rutas (dropdowns, modales y selects responden — el `autoInit` de F6 está cableado en el router).
- [ ] Matar el sidecar Python a mano → el indicador de salud lo refleja; la app no crashea.
- [ ] `pnpm build` y `pnpm lint` pasan (typecheck estricto del preset compartido incluido).

---

## 9. Plan por fases

Cada fase es un PR encadenado propio: chica, revisable, con criterios de cierre verificables. Ninguna fase arranca sin cerrar sus dependencias. Los wrappers Preline de F6 se crean en la fase que los estrena — no se construyen componentes sin consumidor.

| Fase | Nombre | Requerimientos | Depende de | Estado |
| --- | --- | --- | --- | --- |
| 0 | Infraestructura UI | F1 (router base), F4, F5 (skeleton), F6 | — | ✅ Hecha |
| 1 | Autenticación y shell del admin (solo admin seed, con breadcrumbs) | R1, F1 (guards), F2 (session), F3 | 0 | ✅ Hecha (smoke visual pendiente) |
| 2 | Catálogo: marcas | R3 | 1 | ✅ Hecha |
| 3 | Catálogo: modelos + editor de mapa | R4 | 2 | ✅ Hecha |
| 4 | Catálogo: dispositivos | R5 | 3 | ✅ Hecha |
| 5 | Usuarios y permisos | R2, §5 completo | 1 | ✅ Hecha |
| 6 | Backend: gaps de IPC | §6.1, §6.2 | — (backend) | ✅ Hecha |
| 7 | Telemetría: poll + historial | R8, R7 | 4, 6 | ✅ Hecha |
| 8 | Vivo real y pulido | R6, §6.3 | 4 | ✅ Hecha |

### Fase 0 — Infraestructura UI

**Objetivo:** dejar el esqueleto técnico listo para que las fases siguientes solo agreguen features.

- [ ] Instalar `vue-router`, `preline`, `@tailwindcss/forms`.
- [ ] Integración Preline según F6: imports en `main.css`, `import('preline/dist/index.js')` post-mount, tipado `HSStaticMethods` en `env.d.ts`, `autoInit` en `router.afterEach`.
- [ ] Router con rutas placeholder (dashboard, catalog, users, login) SIN guards todavía — solo la estructura y el layout de navegación mínimo.
- [ ] Composable `useApiCall` (F4) + wrapper `AppToast` para feedback de errores/éxito.
- [ ] Namespaces i18n `nav`, `common`, `errors` en `en.json` y `es.json`.
- [ ] Migrar `SystemStatus` y `DeviceLive` a sus rutas sin cambios funcionales.

**Cierre:** `pnpm dev` levanta, se navega entre rutas, un dropdown Preline de prueba sigue vivo tras navegar, `pnpm build` y `pnpm lint` pasan.

### Fase 1 — Autenticación y shell del admin

**Objetivo:** nadie usa la app sin sesión; el flujo de humo del primer arranque funciona completo.

**Alcance acotado (decisión 2026-07-10):** en esta fase NO se trabaja con usuarios reales múltiples — se diseña la experiencia del **admin seed únicamente**: login, su shell con rutas y breadcrumbs. El login es REAL contra `platform.auth.login` (el backend de auth ya está completo; el seed `admin`/`admin` existe) — no se mockea. Todo lo multi-usuario (alta, roles, visibilidad por permisos) queda en Fase 5; en esta fase `hasPermission` existe en el store pero no se aplica en navegación ni rutas.

- [ ] `useSessionStore` (F2): `login/logout/changePassword/restore`, helper `hasPermission(code)` (sin consumo todavía).
- [ ] Pantallas de login y cambio de contraseña (R1.1, R1.3) con `AppInput`/`AppPasswordInput`.
- [ ] Guards F1: sin sesión → `login`; con `mustChangePassword` → solo `change-password`. El guard de permisos (§5) queda para Fase 5.
- [ ] Shell F3 del admin: header con `displayName`/`roleName`, `AppDropdown` de usuario con logout, `LanguageSwitcher`, indicador de salud del sidecar.
- [ ] **Breadcrumbs (F3)**: `AppBreadcrumb` sobre Preline Breadcrumb, derivado de `route.matched` + `meta.breadcrumb` (claves i18n); visible en toda vista interna.
- [ ] Rehidratación al montar (R1.2) y logout limpio (R1.4).
- [ ] Migrar `useToast` a store Pinia y extraer las constantes de nombres de error de dominio a `@platform/shared-types` (deudas diferidas del arch-guard de Fase 0).
- [ ] Namespace i18n `auth`.

**Cierre:** flujo `admin`/`admin` → cambio forzado → dashboard (R1.5); imposible navegar con el gate activo; reload del renderer conserva la sesión.

### Fase 2 — Catálogo: marcas

**Objetivo:** primer CRUD completo de punta a punta; establece el patrón de tabla + modal + toast que reutiliza todo el catálogo.

- [x] `useCatalogStore` (parte marcas) sobre `platform.catalog.brands.*`.
- [x] Isla Inventory con `AppTabs` (marcas | modelos | dispositivos — las otras dos vacías).
- [x] Wrappers `AppTable`, `AppModal`/`ConfirmDialog`, `AppEmptyState`.
- [x] Lista, alta, renombrar (R3.1); borrado con confirmación y `BrandInUseError` legible (R3.2).
- [x] Namespace i18n `catalog` (parte marcas).

**Cierre:** CRUD de marcas completo contra la app corriendo; borrar marca con modelos muestra el error de dominio, la marca sobrevive.

### Fase 3 — Catálogo: modelos + editor de mapa de registros

**Objetivo:** la pieza de UI más grande del alfa. Fase dedicada exclusivamente a esto.

- [x] Lista por marca y global (R4.1) reutilizando `AppTable`.
- [x] Alta de modelo (R4.2) y editor de mapa (R4.3): tabla editable compuesta con `AppSelect` + `AppInput`, validación espejo del schema zod (R4.4).
- [x] Edición de mapa existente con advertencia sobre `metric` (R4.5) vía `ConfirmDialog`.
- [x] Borrado con `MeterModelInUseError` (R4.6).
- [x] Verificación con el seed `SIM-100` (R4.7).

**Cierre:** crear un modelo con 3+ métricas desde la UI, editarlo, y ver `SIM-100` renderizado correcto; métricas duplicadas y address fuera de rango se rechazan ANTES de enviar.

### Fase 4 — Catálogo: dispositivos

**Objetivo:** cerrar el catálogo con el formulario condicional por transporte.

- [x] Lista con `AppBadge` (transporte, enabled) y `AppToggle` para enable/disable (R5.1, R5.4).
- [x] Alta/edición con formulario condicional por transporte (R5.2, R5.3): `serial`/`tcp` con sus campos, `simulated`/`csv` sin conexión.
- [x] Borrado con confirmación (R5.5).
- [x] Namespace i18n `catalog` completo.

**Cierre:** crear dispositivos `simulated`, `tcp` y `csv` desde la UI; el seed `Test simulator` visible y editable; validación de conexión por transporte funcionando.

### Fase 5 — Usuarios y permisos

**Objetivo:** gestión de usuarios y enforcement de permisos en TODA la app (recién acá hay usuarios no-admin para probarlo).

- [x] `useUsersStore`; tabla de usuarios (R2.1), alta (R2.2), cambio de rol (R2.3); `isActive` visible sin acción (R2.4).
- [x] Guard de permisos en `meta` de cada ruta (§5) + navegación que oculta secciones sin permiso.
- [x] Acciones de escritura del catálogo ocultas sin `devices.manage` (modo solo-lectura con `devices.view`).
- [x] Namespace i18n `users`.

**Cierre:** crear un `operator` y un `viewer`; login con cada uno y verificar visibilidad exacta según §5.

### Fase 6 — Backend: gaps de IPC (fuera de `apps/frontend`)

**Objetivo:** habilitar telemetría desde el renderer. Sigue `.claude/skills/add-rpc-method/SKILL.md`; se puede hacer en paralelo con las fases 2–5.

- [x] `telemetry:getHistory` (§6.1): canal IPC + `PlatformApi.telemetry` + preload + handler delegación.
- [x] `acquisition:simulatedPoll` (§6.2): ídem con `PlatformApi.acquisition`.
- [x] Tests de frontera (zod en IPC) según el patrón existente.

**Cierre:** ambos métodos invocables desde la consola del renderer con datos reales; `pnpm test` verde (recordar `rebuild:node`).

### Fase 7 — Telemetría: poll simulado + historial

**Objetivo:** el ciclo de datos completo visible: generar → persistir → graficar.

- [x] Acción "generar datos" en dispositivos `simulated` con resultado visible (R8).
- [x] Elegir e integrar la librería de gráficos (R7.4) — un solo componente presentacional de gráfico (`TelemetryChart.vue`, Chart.js + vue-chartjs).
- [x] Vista de historial: selector de métrica (derivado del mapa del modelo), presets de rango, `bucketMs` acorde (R7.1); gráfico avg con banda min–max (R7.2); estado vacío correcto (R7.3).
- [x] Namespace i18n `telemetry`.

**Decisión de UX 2026-07-20:** telemetría pasó a tener entrada propia en el sidebar (`Telemetría` → `/telemetry/:deviceId?`, con selector de dispositivo) en vez de vivir únicamente colgada de una fila de `/devices`. Los botones "historial" y "generar datos" de cada fila de `DevicesView.vue` se mantienen como accesos rápidos (deep-link a la vista consolidada / acción inline), no se duplicó lógica de negocio.

**Cierre:** poll de 100 ticks sobre el seed → historial graficado min/avg/max; rango sin datos muestra vacío, no error.

### Fase 8 — Vivo real y pulido

**Objetivo:** cerrar el alfa con la vista en vivo alimentada por datos coherentes.

- [x] Backend §6.3: reemplazar `_emit_readings` placeholder por `SimulatedReader` con el mapa del dispositivo.
- [x] Vista en vivo completa (R6): estado por `AppBadge`, últimas lecturas por métrica, gráfico de ventana reciente reutilizando el componente de Fase 7, cleanup verificado en unmount.
- [ ] Pasada final del checklist §8 completo con los 3 roles — pendiente de smoke manual.

**Cierre:** checklist §8 íntegro en verde — fin del alfa.
