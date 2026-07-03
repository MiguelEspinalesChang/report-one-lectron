# Registro de Agentes y Skills de IA

Tooling del proyecto para desarrollo asistido por IA. Fuente de verdad de la arquitectura: `docs/ARCHITECTURE.md`. Guía operativa: `CLAUDE.md`.

## Agentes (`.claude/agents/`)

| Agente | Propósito | Cuándo usarlo |
|---|---|---|
| `arch-guard` | Revisión adversarial de diffs contra las reglas de arquitectura (§11). Solo lectura. | Antes de cada commit/PR que toque más de un archivo o cualquier frontera de proceso |
| `modbus-sidecar` | Implementación del núcleo de datos Python (adquisición, scheduler, storage, imports, reportes, RPC). | Cualquier trabajo dentro de `apps/python-service` |

## Skills (`.claude/skills/`)

| Skill | Trigger | Qué hace |
|---|---|---|
| `add-feature` | nuevo feature, caso de uso, servicio de negocio | Crea un feature hexagonal en `packages/core`: dominio, puertos, caso de uso, adaptadores |
| `add-python-process` | proceso de python, python job, importador, parser | Crea un proceso hexagonal en `apps/python-service` con Protocols como puertos |
| `add-rpc-method` | new RPC method, sidecar command, push event, nuevo metodo RPC | Cablea un comando/evento a través de shared-types → core → electron → python, con tests |
| `add-island` | new island, new view, nueva isla, nueva vista | Crea una isla Vue contenedor/presentacional conectada a `window.platform`, con reglas de ciclo de vida |
| `verify-stack` | verify app, probar la app, correr la app | Build + tests + lint + smoke run en vivo de los tres procesos |

Patrón transversal: **arquitectura hexagonal** — guía normativa en `docs/HEXAGONAL.md` (regla de dependencia, estructura por capa, testing con fakes de puertos).

## Convenciones para nuevos skills/agentes

- Skills: un directorio por skill con `SKILL.md`; el frontmatter requiere `name`, `description` de una línea que empiece con `Trigger:`, `license`, `metadata.author` y `metadata.version`. Instrucciones imperativas, objetivo 180–450 tokens.
- Agentes: markdown con frontmatter `name`, `description`, `tools`; el system prompt declara las reglas de dominio que pisan a las prácticas genéricas.
- Registrar cada agregado en este archivo.
