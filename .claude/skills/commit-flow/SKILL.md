---
name: commit-flow
description: "Trigger: commit, hacer commit, subir cambios, guardar cambios, commitear. Flujo de commits del proyecto: verificación de rama, build, agrupación por workspace y conventional commits con gitmoji."
license: Apache-2.0
metadata:
  author: MiguelEspinalesChang
  version: "1.0"
---

## Contrato de activación

Usar cada vez que el developer pida commitear cambios. Seguir los pasos EN ORDEN. Los pasos marcados 🤖 los ejecutan los hooks de husky automáticamente — no duplicarlos, pero saber que existen para explicar sus fallos.

## Reglas duras

- Formato del mensaje: `<tipo>(<scope>): <gitmoji> <descripción>` — el gitmoji va DESPUÉS de los dos puntos. El hook commitlint exige conventional commits; un emoji al inicio ROMPE el formato y el commit es rechazado.
- Nunca usar `--no-verify`. Si un hook falla, se corrige la causa.
- Nunca agregar `Co-Authored-By` ni atribución a IA.
- Nunca commitear `.env`, credenciales, `*.db` ni artefactos de build (ya están en .gitignore — si aparecen en staging, advertir y excluir).
- Un commit por área/feature — no mezclar workspaces sin relación en un mismo commit.

## Pasos

### 1 — Verificar rama
`git branch --show-current`. Mostrarla y preguntar: "¿Es esta la rama correcta?" **Esperar respuesta.** Debe ser `feature/*`, `release/*` o `hotfix/*` (🤖 el pre-commit bloquea main/develop igual, pero verificar antes evita trabajo perdido).

### 2 — Revisar y agrupar cambios
`git status` + `git diff --stat`. Mostrar resumen agrupado por área:

| Archivos en | Grupo / scope |
|---|---|
| `packages/shared-types/` | `shared-types` — contratos (suele acompañar a otro grupo) |
| `packages/core/` | `core` |
| `apps/electron/` | `electron` |
| `apps/frontend/` | `frontend` |
| `apps/python-service/` | `python` |
| `packages/ui-components/` | `ui` |
| `packages/tsconfig/`, `packages/eslint-config/`, raíz | `config` |
| `docs/`, `*.md`, `.claude/` | `docs` |
| `database/` | `db` |

Excepción: un cambio que cruza capas por el MISMO feature (ej: un método RPC nuevo toca shared-types + core + electron + python) es UN commit — la unidad es el feature, no la carpeta.

### 3 — Confirmar con el developer
"¿Confirmás que procedemos con estos commits?" **Esperar respuesta.** Si pide ajustes, no proceder.

### 4 — Build y tests
`pnpm build` — obligatorio siempre. Si el cambio tocó `core`, `python` o `shared-types`: también `pnpm test`. Si falla: mostrar el error exacto, corregir, repetir. Solo continuar en verde.

### 5 — Idioma
Preguntar UNA vez por sesión: "¿Mensajes en español o inglés?" Usar ese idioma en toda la sesión.

### 6 — Crear commits
🤖 Al commitear corren: pre-commit (guard de rama + lint-staged con eslint/ruff --fix) y commit-msg (commitlint). Gitmojis del proyecto:

| Gitmoji | Uso | Ejemplo |
|---|---|---|
| ✨ | nueva funcionalidad | `feat(core): ✨ agregar caso de uso de inventario` |
| 🐛 | corrección de bug | `fix(python): 🐛 corregir dedup en batch writer` |
| ♻️ | refactoring | `refactor(core): ♻️ extraer puerto DataCoreGateway` |
| 💄 | UI / estilos | `style(frontend): 💄 unificar espaciado de islas` |
| 🔧 | configuración | `chore(config): 🔧 endurecer reglas de tsconfig` |
| 🔌 | RPC / IPC / contratos | `feat(shared-types): 🔌 agregar contrato import.csv` |
| 📡 | adquisición Modbus | `feat(python): 📡 agregar transporte RTU serial` |
| 🗃️ | base de datos / stores | `feat(db): 🗃️ migración inicial de app.db` |
| 🧪 | tests | `test(core): 🧪 cubrir timeout del bridge` |
| 📝 | documentación | `docs(docs): 📝 actualizar guía hexagonal` |

## Ante errores

| Situación | Acción |
|---|---|
| Rama incorrecta / no confirmada | Detener; esperar cambio de rama |
| Build o tests fallan | Mostrar error exacto, corregir, re-ejecutar; nunca commitear en rojo |
| commitlint rechaza el mensaje | Corregir el formato (tipo primero, gitmoji después de `:`) — jamás `--no-verify` |
| lint-staged modifica archivos | Los fixes quedan incluidos automáticamente; revisar el diff final |
| No hay cambios | Notificar "No hay cambios pendientes" y terminar |

## Contrato de salida

Commits creados listados con hash y mensaje, `git status` limpio, build/tests en verde reportados con salida real.
