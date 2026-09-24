# Rediseño UI del frontend — Tokens, componentes base y Design System

**Estado:** IMPLEMENTADO (T1–T6) — pendiente smoke visual con la app corriendo
**Rama sugerida:** `feature/frontend-ui-redesign`
**Origen:** handoff de diseño "NubiaAdmin" (Tailwind v3 + Preline + Vue 3), adaptado a la realidad de este proyecto.
**Relación con el plan alfa:** transversal a `docs/features/in-progress/frontend-alpha-requirements.md`. No bloquea las fases 2–5; conviene hacerlo ANTES de construir el CRUD de catálogo/usuarios para no re-estilizar después.

---

## 1. Adaptaciones respecto al handoff original

El documento de origen asume un stack que no es el nuestro. Estas decisiones son vinculantes para todas las tareas:

| Handoff original | Adaptación en este proyecto | Motivo |
|---|---|---|
| `tailwind.config.js` (Tailwind v3) | Tokens en `@theme` dentro de `src/assets/main.css` | El proyecto usa Tailwind v4 (`@tailwindcss/vite`, sin config file) |
| Figtree vía Google Fonts | `@fontsource/figtree` autohospedada (npm) | App offline-first: prohibido depender de CDN en runtime |
| Font Awesome 6 | Mantener SVG inline (estilo heroicons) | Cero dependencias nuevas de iconos; es el patrón ya establecido en `AppSidebar` |
| Paleta `accent-*` inexistente en el handoff | Migrar los tokens `accent-*` (hoy alias de indigo) a la nueva paleta `primary-*` y eliminarlos | Una sola paleta de marca; evitar dos nombres para lo mismo |
| Sidebar 260px | Mantener `w-64` (256px) | Diferencia de 4px sin valor; evita token de spacing custom |
| `spacing: { '4.5': '18px', ... }` | No se necesita | En Tailwind v4 la escala de spacing es dinámica: `p-4.5` (18px) y `p-5.5` (22px) funcionan de fábrica |
| Marca "NubiaAdmin", dominio pedidos/ventas/productos | Dominio real: dispositivos Modbus, catálogo, usuarios, telemetría | Los KPI, tablas y nav del prompt original son ejemplos, no requisitos |
| Textos hardcodeados en español | Todo texto visible pasa por `t('...')` con claves en `en.json` Y `es.json` | Convención i18n del proyecto (CLAUDE.md) |
| Componentes sugeridos `AppTopbar`, `OrdersTable`… | Se crean solo los que faltan; el shell (sidebar/topbar/breadcrumbs) ya existe y se re-estiliza | Fases 0–1 ya entregaron el layout |

---

## 2. Tokens de diseño (destino final de `@theme`)

Reemplaza el bloque `@theme` actual de `apps/frontend/src/assets/main.css`. Namespaces de Tailwind v4: `--color-*`, `--font-*`, `--radius-*`, `--shadow-*`, `--container-*`.

```css
@theme {
  --font-sans: "Figtree", ui-sans-serif, system-ui, sans-serif;

  /* Primary — blue (buttons, links, active nav) */
  --color-primary-50: #e8f0fd;
  --color-primary-100: #d9e7fb;
  --color-primary-200: #b9d0f6;
  --color-primary-300: #8fb2f0;
  --color-primary-400: #5b8de8;
  --color-primary-500: #3f7ce4;
  --color-primary-600: #2f6fe0;
  --color-primary-700: #2661c9;
  --color-primary-800: #1d54b8;
  --color-primary-900: #173f8a;

  /* Success — green (badges, toggles, positive state) */
  --color-success-50: #e3f5ef;
  --color-success-100: #d4efe6;
  --color-success-200: #c4e8db;
  --color-success-300: #8ed4ba;
  --color-success-400: #3cb693;
  --color-success-500: #22a582;
  --color-success-600: #129573;
  --color-success-700: #0f8465;
  --color-success-800: #0d7259;
  --color-success-900: #0a5744;

  /* State palettes */
  --color-warning-50: #fef6e0;
  --color-warning-600: #c98a15;
  --color-warning-800: #9a6b0f;
  --color-danger-50: #fdecec;
  --color-danger-200: #f6d2d2;
  --color-danger-600: #cf4444;
  --color-danger-800: #b42323;

  /* Standard border for cards, sidebar, topbar */
  --color-line: #e7edf3;

  --radius-card: 14px;
  --radius-btn: 10px;

  /* Input focus ring */
  --shadow-ring: 0 0 0 3px #e8f0fd;

  /* Content max widths */
  --container-content: 1240px;
  --container-ds: 1100px;
}
```

Guía rápida de uso (equivalencias v4):

| Uso | Clases |
|---|---|
| Fondo de página | `bg-slate-50` |
| Card | `bg-white border border-line rounded-card` (vía `.island`) |
| Botón primario | `bg-primary-600 hover:bg-primary-700 text-white rounded-btn` (vía `.btn-primary`) |
| Badge éxito | `bg-success-50 text-success-800 rounded-full px-2.5 py-0.5 text-xs font-semibold` |
| Nav activo | `bg-primary-50 text-primary-800 font-semibold rounded-btn` |
| Input focus | `focus:border-primary-600 focus:shadow-ring` |
| Ancho contenido | `max-w-content` / `max-w-ds` |
| Paddings 18/22/28px | `p-4.5` / `p-5.5` / `p-7` (escala dinámica de v4, sin token) |

---

## 3. Tareas

### T1 — Fundaciones: tokens + tipografía ✅

- [x] Agregar `@fontsource/figtree` a `apps/frontend` (pesos 400/500/600/700/800) e importarlo en `main.ts` o `main.css`. Verificar que el build de Vite empaqueta los woff2 (nada de CDN).
- [x] Reemplazar el bloque `@theme` de `main.css` por los tokens de la sección 2 (elimina los alias `accent-*`).
- [x] Actualizar `@layer base`: `bg-slate-50` como fondo de página (hoy `bg-slate-100`) y `font-family` vía `--font-sans`.
- [x] `pnpm --filter @platform/frontend build` debe pasar sin clases rotas.

> **Nota de implementación**: se agregó `--color-danger-100: #fadfdf` (interpolado entre `danger-50` y `danger-200`) porque `.btn-danger` usa `hover:bg-danger-100` y la rampa danger del spec tenía ese hueco. Aditivo — no altera ningún hex especificado.

### T2 — Migración `accent-*` → `primary-*` ✅

Los tokens `accent-*` desaparecen; todo usage se migra. Ubicaciones conocidas (confirmar con `rg 'accent-' apps/frontend/src`):

- [x] `main.css` — `.btn-primary` (border/bg `accent-600`, hover `accent-700`).
- [x] `components/AppSidebar.vue` — `active-class="bg-accent-50 text-accent-700 …"` → `bg-primary-50 text-primary-800 font-semibold`.
- [x] `components/AppBreadcrumb.vue` — `hover:text-accent-600` → `hover:text-primary-600`.
- [x] Revisar `AppInput.vue`, `AppPasswordInput.vue`, `AppDropdown.vue`, `LanguageSwitcher.vue`, `AppToast.vue` y las islas de Auth por usos restantes de `accent-*` o `blue-*` de Preline. (`AppToast` usaba emerald/red semánticos — se dejaron; no había `blue-*` de Preline.)
- [x] Al terminar: `rg 'accent-'` en `apps/frontend/src` debe devolver cero resultados.

### T3 — Clases compartidas `.island` / `.btn` y variantes ✅

En `@layer components` de `main.css`:

- [x] `.island`: borde `border-line`, radio `rounded-card` (14px), padding `p-5.5`, `shadow-sm` conservada.
- [x] `.btn`: radio `rounded-btn` (10px), `font-semibold`, padding `px-4 py-2.5`.
- [x] Nuevas variantes junto a `.btn-primary`:
  - `.btn-success` — verde sólido (`success-600` / hover `success-700`).
  - `.btn-soft` — azul claro (`bg-primary-50 text-primary-800 hover:bg-primary-100`).
  - `.btn-ghost` — sin borde ni fondo, hover `slate-100`.
  - `.btn-danger` — rojo suave (`bg-danger-50 text-danger-800 border-danger-200`).
- [x] Estado disabled consistente en todas las variantes (ya existe en `.btn`).

### T4 — Componentes base nuevos (presentacionales, en `src/components/`) ✅

Todos puros (props in, eventos out), sin acceso a `window.platform`, textos vía i18n:

- [x] Badge de estado con variante outline + punto de color. **Decisión 2026-07-20**: en vez de crear `StatusBadge.vue`, se EXTENDIÓ `AppBadge.vue` (que ya existía, genérico y migrado a tokens) con una prop `variant?: 'soft' | 'outline'` (default `soft` = comportamiento previo intacto; `outline` = borde del tono + fondo blanco + punto `{tone}-500`). Una sola pieza de badge, sin duplicar. Tonos: `neutral`/`primary`/`success`/`warning`/`danger`.
- [x] `AvatarInitials.vue` — iniciales sobre fondo suave o sólido (primary/success), tamaño configurable (`sm`/`md`/`lg`), indicador online opcional. Se usa en el chip de usuario del topbar (T6) y en futuras tablas de usuarios.
- [x] `KpiCard.vue` — etiqueta (13px `slate-500`), valor (26px bold), badge de variación opcional (pill success/danger suave) + texto comparativo. Reutiliza `.island`.
- [x] `AppAlert.vue` — variantes success/info/danger (info = paleta primary): fondo suave, borde a juego, icono circular, título bold + descripción.
- [x] Formularios: `AppInput.vue`/`AppPasswordInput.vue` rediseñados a tokens del DS (error `danger-600` + `shadow-ring-danger` + mensaje `danger-800`; focus `border-primary-600` + `shadow-ring`; radio `rounded-btn`); `AppSelect.vue` (nativo estilizado) suma prop `errorText`; `AppToggle.vue` (verde, ya existía) suma foco visible por teclado; `AppCheckbox.vue` creado (azul/primary). Nota: los inputs NO envuelven Preline — son nativos estilizados con `@tailwindcss/forms`, que es el patrón real del proyecto.
- [x] Claves i18n nuevas: ninguna — todos los textos visibles de estos componentes llegan traducidos por prop desde el consumidor. Las claves se agregarán en T5/T6, donde se montan con texto real.

> **Nota de implementación**: se agregó `--shadow-ring-danger: 0 0 0 3px #fdecec` en `@theme` (mirror de `--shadow-ring` con `danger-50`) para el "ring rojo suave" del estado de error. Aditivo — no altera ningún token previo.

### T5 — Página Design System ✅

- [x] Ruta `/design-system` (name `design-system`, `meta.breadcrumb: 'nav.designSystem'`, sin `permission` — accesible a cualquier sesión, como dashboard) → `islands/Settings/DesignSystemView.vue`. Contenido `max-w-ds` centrado.
- [x] Sidebar: grupos de navegación ("General" / "System") en `AppSidebar.vue` — el prop pasó de `items: NavItem[]` a `groups: NavGroup[]` (`{ titleKey, items }`); el gating de permisos sigue en `App.vue` (`visibleNavGroups`). El ítem Design System va en "System".
- [ ] Secciones de la página (documenta lo REAL del proyecto, no lo del handoff):
  - Encabezado con eyebrow verde uppercase + botón secundario de vuelta al dashboard.
  - Paleta: cards Primary / Success / Slate con swatches 50/200/400/600/800 (swatch + step + hex).
  - Tipografía: escala display 30/800, h1 24/700, h2 18/700, body 14/400, caption 12/500.
  - Botones: todas las variantes de T3 + disabled.
  - Formularios: input con label, select, input en error, toggle, checkbox.
  - Badges: todos los tonos de `AppBadge` (soft) + variante outline con punto.
  - Avatares: variantes de `AvatarInitials` (suave, sólido, online, tamaños). El contador "+N" se omitió: `AvatarInitials` deriva iniciales de palabras, no soporta un literal "+3" sin modificar su contrato.
  - Alertas: las tres variantes de `AppAlert`.
  - Cards: `.island` básica, `KpiCard` y card destacada con gradiente `primary-600 → success-600`.
- [x] Textos de la página vía i18n (EN/ES) — namespace `designSystem.*`, paridad verificada.

### T6 — Re-estilizado del shell y dashboard ✅

- [x] `AppSidebar.vue`: fondo blanco, `border-e border-line`, grupos de nav con encabezado uppercase 11px `slate-400`, ítems `rounded-btn`, logo/marca con gradiente `primary → success`.
- [x] Topbar (`App.vue`): `border-b border-line`, chip de usuario con `AvatarInitials`. No se extrajo `AppTopbar.vue` — `App.vue` sigue manejable.
- [x] `<main>`: `bg-slate-50`, contenido envuelto en `max-w-content` con `p-7`.
- [x] `DashboardView.vue`: encabezado (título + saludo con `displayName`) y fila de `KpiCard` con datos REALES: estado del sidecar (`platform.system.ping`), conteo de dispositivos (`useCatalogStore().devices.length`), rol de la sesión (`session.roleName`). Sin deltas ni datos inventados.
- [x] `SystemStatus.vue` / `SidecarHealth.vue`: adoptan `.island` y `AppBadge` (variant outline). `DeviceLive.vue` ya no existe (reemplazado por `DeviceLiveView.vue`, que ya usa `AppBadge` desde Fase 8).

### Diferido (NO hacer ahora)

- **Gráfico de barras de ingresos/telemetría**: sin datos reales hasta Fase 7 (historial de telemetría). No montar charts con datos fake.
- **Tabla "pedidos recientes"**: no existe ese dominio. El patrón de tabla (header uppercase 11px, hover `slate-50`, pills de estado) se aplica cuando lleguen las tablas reales de catálogo (Fase 2–4) y usuarios (Fase 5).
- **Card "Plan Pro"** del sidebar: no aplica al producto.

---

## 4. Orden y criterios de cierre

Orden: **T1 → T2 → T3** (una sola PR: tokens + migración, la app no debe quedar a mitad de paleta) → **T4 → T5** (componentes + página que los documenta) → **T6** (re-estilizado).

Criterios de cierre:

- `rg 'accent-'` sin resultados en `apps/frontend/src`.
- `pnpm --filter @platform/frontend build` y `pnpm lint` en verde.
- App funcional offline: sin requests a CDN (verificar en devtools con red desconectada).
- Todo texto nuevo presente en `en.json` y `es.json`.
- La página `/design-system` refleja exactamente los componentes reales (es documentación viva, no mockup).
