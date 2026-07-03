---
name: add-feature
description: "Trigger: new feature, nuevo feature, caso de uso, use case, servicio de negocio, business service. Crea un feature hexagonal en packages/core: dominio, puertos, caso de uso, adaptadores."
license: Apache-2.0
metadata:
  author: MiguelEspinalesChang
  version: "1.0"
---

## Contrato de activación

Usar al agregar cualquier lógica de negocio a `packages/core`. Guía completa con ejemplos: `docs/HEXAGONAL.md` §3.

## Reglas duras

- Estructura por feature (screaming architecture): `src/<feature>/{domain,ports,application,adapters}/`.
- `domain/` no importa NADA de infraestructura (ni drizzle, ni electron, ni el bridge). Solo tipos y funciones puras.
- Los casos de uso (`application/`) reciben puertos por constructor. Nunca instancian adaptadores ni importan desde `adapters/`.
- Los adaptadores son los únicos que importan librerías de infraestructura. El sidecar Python se consume a través de un puerto (`DataCoreGateway`-style) implementado por un adaptador que envuelve `PythonBridge` — nunca inyectar el bridge directo en un caso de uso.
- Cableado concreto SOLO en `createCore()` (composition root, `src/index.ts`).
- No inventar puertos para CRUDs sin reglas de negocio (ver `docs/HEXAGONAL.md` §8): el puerto nace con la primera regla o el segundo consumidor.

## Pasos

1. `domain/`: entidades + reglas puras del feature.
2. `ports/`: interfaces que el dominio necesita, en vocabulario de negocio.
3. `application/`: caso de uso que orquesta dominio + puertos (inyección por constructor).
4. `adapters/`: implementaciones concretas (sqlite/drizzle, gateway al sidecar).
5. Cablear en `createCore()` y exponer en la interface `Core`.
6. Si la UI lo consume: skill `add-rpc-method` (el handler IPC sigue siendo una línea).
7. Tests: dominio con datos en memoria (sin mocks); caso de uso con fakes de puertos (clases in-memory de pocas líneas); adaptadores con integración real.

## Contrato de salida

Estructura de carpetas creada, cableado en composition root, capas listadas, `pnpm build` y `pnpm --filter @platform/core test` en verde.
