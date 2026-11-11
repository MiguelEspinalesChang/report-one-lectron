# Feature: Cifrado en reposo de las bases SQLite (`app.db` / `telemetry.db`)

> Estado: **DEFINIDO — pendiente de implementación**
> Objetivo: que un build empaquetado no permita abrir `app.db` ni `telemetry.db` copiando el archivo (DBeaver, `sqlite3`, etc.) sin la clave; en dev (`pnpm dev`) ambas bases siguen abriéndose en claro con una connection string normal.
> Documentos normativos: `docs/ARCHITECTURE.md` §11 (propiedad de procesos), `docs/HEXAGONAL.md`, `docs/features/installer-packaging.md` (empaquetado, módulos nativos)

## 1. Problemática

SQLite no tiene autenticación de usuario/contraseña: cualquiera que copie `app.db` o `telemetry.db` desde `userData` (o desde un backup) puede abrirlos con cualquier cliente SQLite genérico y leer todo su contenido — usuarios, dispositivos, mapas de registros Modbus, telemetría histórica. Hoy (`packages/core/src/persistence/adapters/sqlite-database.ts`, `apps/python-service/storage/migrations.py`) ambos archivos se abren en modo WAL sin ningún cifrado.

En dev se necesita justo lo contrario: poder abrir el archivo con una connection string plana en DBeaver para depurar. El feature tiene que resolver ambos requisitos a la vez, no uno a costa del otro.

## 2. Modelo de amenazas

**Protege contra:**

- Copiar el archivo `.db` (USB, red compartida, un backup mal ubicado) y abrirlo con un cliente SQLite genérico sin la clave.
- Otro usuario del mismo sistema operativo (multi-usuario) leyendo el archivo si los permisos de filesystem fallan o son insuficientes.
- Un backup en reposo (disco, nube) quedando expuesto sin cifrado propio del medio.

**NO protege contra:**

- Un atacante con la sesión del usuario ya desbloqueada mientras la app corre: la clave vive en memoria de los procesos Electron main / core / sidecar mientras la base está abierta, igual que cualquier cifrado en reposo.
- Un atacante con acceso root/administrador a la máquina en ejecución (puede volcar memoria de proceso, o en Linux leer `safeStorage` si el secret store está desbloqueado).
- Errores de lógica de negocio o fugas por RPC/IPC — esto es cifrado de archivo, no control de acceso a nivel de aplicación (eso ya existe vía `users.manage`, sesión, etc.).

## 3. Decisión propuesta y alternativas

| Opción | Cubre el requisito ("copiar el archivo no debe abrir") | Costo de implementación | Notas |
|---|---|---|---|
| **SQLCipher (vía `better-sqlite3-multiple-ciphers` + binding Python compatible)** — recomendada | Sí, cifra el 100% del archivo | Medio-alto: dos dependencias nativas nuevas, gestión de clave, handoff entre procesos | Cifra ambos archivos completos de forma uniforme en los dos procesos que los escriben |
| Solo permisos de OS en el archivo (`chmod 600` equivalente) | **No** — un archivo copiado a otra máquina no lleva permisos de OS | Bajo | Complementario, no sustituto: no resuelve "copiar el archivo" que es el requisito explícito |
| Cifrado a nivel de campo (encriptar columnas sensibles desde la app) | Parcial — dejaría estructura/schema y telemetría masiva en claro | Alto: hay que tocar cada columna sensible en Drizzle y en Python, mantenerlo sincronizado en dos lenguajes | No hay hoy columnas claramente "solo esas" que valga la pena aislar (los password hashes ya van con argon2); el resto es configuración de negocio y telemetría, cifrar campo por campo no simplifica nada frente a cifrar el archivo entero |

Se propone **SQLCipher** como mecanismo, porque es el único que cumple el requisito literal ("no abre en DBeaver sin la clave") de forma pareja en `app.db` y `telemetry.db`, sin duplicar lógica de cifrado por columna en dos lenguajes.

Los permisos de OS restrictivos sobre `userData` siguen siendo una buena práctica adicional de bajo costo, pero no reemplazan el cifrado — se recomienda mantenerlos como control complementario, no como alternativa.

## 4. Diseño por proceso

### 4.1 Electron main — ciclo de vida de la clave

- Al primer arranque **empaquetado** (`app.isPackaged === true`), tras `await app.whenReady()` (requisito de `safeStorage`, ver §6.3), generar una clave aleatoria de alta entropía (32 bytes) y cifrarla con `safeStorage.encryptStringAsync` (API async recomendada — la síncrona `isEncryptionAvailable`/`encryptString` está deprecada de cara a Electron 46[^1], y este repo ya corre Electron ^44.4.5, cerca de esa versión).
- Persistir el blob cifrado en un archivo bajo `userData` (p. ej. `db.key.enc`); en arranques siguientes, leerlo y desencriptarlo con `decryptStringAsync`.
- La clave en claro nunca se loguea, nunca va a argv, y solo vive en memoria del proceso main (y de los dos procesos que la reciben — core en el mismo proceso, sidecar por el canal que se defina en §4.3).
- Manejar explícitamente el caso `isAsyncEncryptionAvailable() === false` (posible en Linux sin secret store disponible — `getSelectedStorageBackend()` devuelve `basic_text` en ese caso, es decir, el cifrado de `safeStorage` mismo queda sin protección real)[^1]. Qué hacer en ese caso (advertir y seguir en claro, o negarse a arrancar) es una decisión de producto abierta (§10).

### 4.2 Core — adaptador de persistencia

- `createAppDatabase()` (`packages/core/src/persistence/adapters/sqlite-database.ts`) gana una opción nueva, p. ej. `encryptionKey?: Buffer`. Cuando está presente, antes de correr migraciones:
  ```js
  connection.pragma(`cipher='sqlcipher'`)
  connection.pragma(`key="x'${hexKey}'"`)   // clave binaria en formato hex, sin derivación PBKDF2 adicional
  ```
  (el pragma `cipher='sqlcipher'` es obligatorio: el cifrado *default* del fork es `sqleet`, no SQLCipher — sin ese pragma el archivo resultante no sería compatible con el binding Python[^2].)
- Cuando `encryptionKey` está ausente (dev, tests), el comportamiento no cambia: archivo en claro, abrible en DBeaver.
- `sqlite-telemetry-reader.ts` necesita el mismo tratamiento del lado lectura: aplicar `cipher`/`key` antes de `PRAGMA query_only = ON`, cuando el archivo esté cifrado.
- El comentario de cabecera de ambos adaptadores ("only file that imports better-sqlite3") debe actualizarse si el import pasa a ser `better-sqlite3-multiple-ciphers`.

### 4.3 Sidecar Python — escritura de `telemetry.db` cifrada

- `apps/python-service/storage/migrations.py` y el escritor batch (`storage/adapters/sqlite_writer.py`) deben abrir la conexión con la misma clave y los mismos parámetros de cifrado que usó core, para que el archivo sea legible/escribible por ambos.
- **Handoff de la clave al sidecar** (proceso separado, `python-manager.ts` lo spawnea): opciones evaluadas —

  | Mecanismo | Pros | Contras |
  |---|---|---|
  | Variable de entorno (`TELEMETRY_DB_KEY`, mismo patrón que `TELEMETRY_DB_PATH` hoy) | Cambio mínimo, reusa el patrón existente en `python-manager.ts` | El entorno de un proceso hijo es legible por otros procesos del mismo usuario de OS (p. ej. `/proc/<pid>/environ` en Linux) |
  | Handshake por stdin, un mensaje único antes del tráfico JSON-RPC normal | No toca argv/env; stdin está libre hasta que el bridge lo usa | Más código: hay que coordinar un paso previo al protocolo en `python-bridge/client.ts` y en el arranque de `rpc/server.py` |
  | Archivo temporal con permisos restrictivos, leído una vez y borrado | — | Ventana de exposición en disco, más partes móviles que las otras dos opciones |

  **Recomendación**: handshake por stdin como diseño objetivo (menor superficie de exposición), aceptando la variable de entorno como alternativa más barata si el equipo decide que el riesgo de inspección de proceso local es aceptable (el sidecar no está expuesto a red, es un hijo local). Esta es una decisión que conviene cerrar explícitamente antes de la Fase 3 (§9).

### 4.4 Toggle dev vs. build

- Electron main decide con `app.isPackaged` (mismo patrón ya usado en `installer-packaging.md` para `migrationsFolder` y para la estrategia de spawn del sidecar): `false` → no se genera clave, no se pasan pragmas de cifrado, comportamiento actual sin cambios; `true` → se genera/lee la clave y se propaga a core y al sidecar.
- vitest y pytest no pasan por `app.isPackaged` — deben seguir arrancando en claro por defecto (sin regresión), y ganar un modo cifrado opcional y explícito para los tests que verifiquen ese camino (ver §7).

## 5. Migración de bases existentes en claro

Los usuarios que ya tienen `app.db` con datos reales (auth, usuarios, roles ya están implementados — ver commits recientes de `feat(users)`) tendrán, al actualizar a una versión con este feature, un archivo en claro en disco. Hace falta un paso de migración en el primer arranque empaquetado posterior al cambio:

1. Detectar si el archivo está en claro (abrir sin clave; si `sqlite_master` es legible, está en claro).
2. Hacer un backup del archivo original antes de tocarlo — el `rekey` es una operación destructiva in-place; una interrupción a mitad de camino puede dejar el archivo corrupto.
3. Aplicar `pragma cipher='sqlcipher'` + `pragma rekey='...'` (o el equivalente con clave binaria) sobre la conexión abierta — el propio fork documenta que correr `rekey` sobre una base sin cifrar la cifra in-place[^2], no hace falta un paso separado de `sqlcipher_export`/`ATTACH`.
4. Repetir el mismo flujo para `telemetry.db`, pero ejecutado por el sidecar Python (es su archivo, su migración).

Este es un paso con riesgo real (una base de producción, cifrado in-place, backup obligatorio) y debe ser su propia fase, no un detalle de la Fase de adaptador de core.

## 6. Impacto en tests

- El filtro de integración de `packages/core` (`pnpm --filter @platform/core test`) levanta el sidecar Python real — debe seguir corriendo sin clave por defecto (regresión cero), y se agrega una variante que sí pasa una clave de prueba y verifica el pipeline cifrado punta a punta (core escribe/lee, sidecar escribe/lee, ambos con la misma clave).
- pytest necesita el mismo par de casos (con y sin clave) para `storage/migrations.py` y el writer.
- Casos nuevos obligatorios: reapertura con la clave correcta, rechazo explícito con clave incorrecta, y el escenario de migración de una base en claro pre-existente (§5).

## 7. Empaquetado, módulos nativos y `allowBuilds`

- `better-sqlite3-multiple-ciphers` reemplaza (o convive con, a decidir en §10) `better-sqlite3` como dependencia nativa. Debe agregarse a `external` en `apps/electron/esbuild.config.mjs`, como dependencia directa de `apps/electron` (mismo motivo que hoy con `better-sqlite3`/`argon2`: pnpm aísla `node_modules`, sin la dependencia directa el `require` en runtime no resuelve), y a `allowBuilds` en `pnpm-workspace.yaml` si el paquete trae un build script propio (como `better-sqlite3`).
- La versión `v13.0.3` del fork (7 ago 2024) migró a Node-API puro con binarios prebuilt embebidos, requiriendo Node.js ≥ 22 y Electron ≥ 35[^3]. Este repo corre Node 22.19.0 y Electron ^44.4.5 — ambos por encima del mínimo, y la numeración de versión del fork sigue exactamente a `better-sqlite3` (el repo ya usa `better-sqlite3@^13.0.3`), buena señal de que el swap es directo.
- `docs/features/installer-packaging.md` debe actualizarse: la tabla de `asarUnpack` (hoy lista `better-sqlite3`, `argon2`) necesita el nuevo módulo nativo, y el paso de PyInstaller (punto 5 de ese doc) necesita declarar el binding Python de SQLCipher como hidden import si el build congelado no lo detecta automáticamente. Este feature depende de que `installer-packaging` avance (o al menos se coordinen), porque hoy ese doc está "definido, pendiente de implementación".

## 8. Riesgos

| Riesgo | Impacto | Mitigación propuesta |
|---|---|---|
| Pérdida de la clave (o del backend de `safeStorage`) | `app.db` y `telemetry.db` quedan permanentemente ilegibles — no hay puerta trasera en SQLCipher | Definir con el product owner una estrategia de respaldo/recuperación de clave antes de implementar (§10, pregunta 2) |
| `safeStorage` atado a la cuenta de OS (Keychain en macOS, DPAPI en Windows) | Restaurar un backup de `userData` en otra máquina o cuenta de usuario deja la clave escrow no desencriptable aunque el archivo `.db` sobreviva | Documentar la limitación; no es resoluble sin un mecanismo de respaldo independiente del OS |
| Drift de formato entre el fork Node (default `sqleet`, no SQLCipher) y el binding Python | Un archivo escrito por un lado deja de abrir del otro si cambia un default en una actualización de dependencia | Fijar `cipher='sqlcipher'` explícitamente en ambos lados + test de interoperabilidad round-trip (Fase 0) |
| Combinación Node fork + binding Python + Drizzle no verificada en ningún lugar de este repo hoy | Riesgo de descubrir incompatibilidades tarde | Fase 0 de spike obligatoria antes de tocar código de producción |
| Overhead de rendimiento de SQLCipher | Telemetría escribe en lotes de millones de filas | SQLCipher documenta 5–15% de overhead como orden de magnitud[^4] — medir contra el path de batch-write real antes de asumir que es despreciable |

## 9. Plan por fases

Cada fase es un PR razonable; el orden respeta dependencias.

### Fase 0 — Spike de validación (sin código de producción)

- Prototipo descartable: abrir una base con `better-sqlite3-multiple-ciphers` + `cipher='sqlcipher'`, confirmar que Drizzle funciona sin cambios contra el fork, que WAL + `busy_timeout` + migraciones siguen funcionando, y que el binario prebuilt carga bajo vitest (Node) y bajo un smoke de Electron empaquetado sin rebuild.
- Resolver qué paquete Python usar en concreto: el venv de este repo corre Python 3.12 (confirmado: `apps/python-service/.venv` usa CPython 3.12 vía Homebrew); el release más reciente de `rotki-pysqlcipher3` (2026.8.3) publica wheels **solo para CPython 3.14**[^5] — para 3.12 hace falta fijar una versión anterior (`2024.10.1`, oct 2024, última con wheels `cp311`/`cp312`) o subir el venv a 3.14. Evaluar también otros bindings (`sqlcipher3`, `sqlcipher3-binary`) cuyo estado de mantenimiento **no se verificó en esta investigación** (gap de evidencia explícito) antes de comprometerse a uno.
- Test de interoperabilidad round-trip: un archivo escrito por el fork Node con la clave X debe abrir desde Python con la misma clave, y viceversa.
- **Cierre verificable**: test de interoperabilidad pasando, y decisión documentada de qué paquete Python usar (con su versión exacta y por qué).

### Fase 1 — Electron main: ciclo de vida de la clave

- Generación/lectura de clave vía `safeStorage`, gateada por `app.isPackaged`, clave nunca logueada ni en argv.
- Manejo explícito del caso `isAsyncEncryptionAvailable() === false`.
- **Cierre verificable**: test confirmando que la clave se genera una sola vez, persiste cifrada, y es estable entre reinicios; decisión documentada sobre el fallback cuando `safeStorage` no está disponible.

### Fase 2 — Adaptador de core

- `createAppDatabase()` acepta `encryptionKey` opcional; aplica pragmas condicionalmente; el path sin clave (dev/tests) queda intacto.
- **Cierre verificable**: suite existente en verde sin clave (sin regresión) + tests nuevos de modo cifrado (ciclo abrir/leer/escribir/reabrir, rechazo con clave incorrecta).

### Fase 3 — Handoff al sidecar + `telemetry.db` cifrado

- Mecanismo de handoff elegido en §4.3, implementado en `python-manager.ts` / `python-bridge/client.ts` / `rpc/server.py`.
- `storage/migrations.py` y el writer aplican el mismo cifrado.
- **Cierre verificable**: pytest cubriendo el path cifrado, e integración real core↔sidecar (`pnpm --filter @platform/core test`) extendida para correr con clave de punta a punta.

### Fase 4 — Migración de instalaciones existentes en claro

- Detección + backup + `rekey` in-place en ambos archivos, en el primer arranque empaquetado posterior al cambio.
- **Cierre verificable**: escenario partiendo de un fixture en claro, corriendo la migración, y confirmando que el resultado (a) no abre en DBeaver sin clave y (b) abre con clave con los mismos datos, fila por fila.

### Fase 5 — Empaquetado

- `esbuild.config.mjs`, dependencias directas de `apps/electron`, `pnpm-workspace.yaml → allowBuilds`, `installer-packaging.md` (asarUnpack + hidden imports de PyInstaller).
- **Cierre verificable**: `pnpm build` en verde; cuando `installer-packaging` esté implementado, un build empaquetado real no abre en DBeaver sin clave.

## 10. Preguntas abiertas para el product owner

1. Si `safeStorage` no está disponible (Linux sin secret store, backend `basic_text`) — ¿arrancar igual con advertencia visible, o negarse a arrancar?
2. Estrategia ante pérdida de clave: ¿se acepta pérdida total de datos como riesgo conocido, o se necesita un mecanismo de respaldo/escrow (mostrar la clave una vez en el primer arranque, exportarla cifrada con una frase propia del usuario, etc.)?
3. La migración de instalaciones existentes en claro (Fase 4) — ¿puede ser un rekey silencioso en el próximo arranque, o se necesita aviso/consentimiento explícito del usuario antes de cifrar datos que ya tiene?
4. Handoff de la clave al sidecar — ¿variable de entorno (más simple, expuesta a inspección de proceso del mismo usuario de OS) o handshake por stdin (más código, menor superficie)?
5. ¿Reemplazar `better-sqlite3` por `better-sqlite3-multiple-ciphers` en todo el proyecto (una sola dependencia nativa, incluso en dev sin cifrar) o mantener ambas (más superficie de mantenimiento, cero riesgo de regresión en dev)?
6. Confirmar el alcance de "atacante" aceptado para este feature: solo copiar el archivo (lo que SQLCipher resuelve) — el modelo de amenazas de §2 deja explícitamente fuera a un atacante con la sesión del usuario desbloqueada o con acceso root/admin a la máquina en ejecución, ¿es eso aceptable como alcance final?

## 11. Fuentes consultadas

[^1]: Electron, `docs/api/safe-storage.md` y `docs/breaking-changes.md` (vía Context7 `/electron/electron`) — comportamiento por plataforma (Keychain/DPAPI/secret store Linux, fallback `basic_text`), requisito de `app.whenReady()`, y deprecación de la API síncrona de cara a Electron 46 en favor de `isAsyncEncryptionAvailable`/`encryptStringAsync`/`decryptStringAsync`.

[^2]: `better-sqlite3-multiple-ciphers`, `README.md` y `docs/api.md` (vía Context7 `/m4heshd/better-sqlite3-multiple-ciphers`) — cifra default `sqleet` (requiere `cipher='sqlcipher'` explícito para compat real con SQLCipher/legacy tools), `pragma rekey` cifra in-place una base en claro, `db.key()`/`db.rekey()` para claves binarias, soporte de `journal_mode = WAL`.

[^3]: GitHub `m4heshd/better-sqlite3-multiple-ciphers`, página de releases (vía WebFetch, fetch directo del 2026-09-24) — release `v13.0.3` (7 ago 2024) migrado a Node-API con binarios prebuilt embebidos; mínimos Node.js ≥ 22 y Electron ≥ 35; deja de dar soporte a Windows x86 y Linux armv7.

[^4]: SQLCipher, `README.md` y `src/sqlcipher.c` (vía Context7 `/sqlcipher/sqlcipher`) — derivación de clave PBKDF2 (SHA-512, 256000 iteraciones por defecto en v4, configurable con `cipher_compatibility`), soporte de clave binaria hex sin derivación, overhead de rendimiento estimado "5-15%" declarado por el propio proyecto.

[^5]: `rotki-pysqlcipher3` — descripción vía Context7 `/rotki/pysqlcipher3` (DB-API 2.0, `connect(..., key=...)`, enlazado estático con SQLCipher/OpenSSL) y verificación directa en PyPI (vía WebFetch, `pypi.org/pypi/rotki-pysqlcipher3/json`, 2026-09-24): release `2026.8.3` (27 ago 2026) publica wheels solo para `cp314`/`cp314t`; el último release con wheels `cp311`/`cp312` fue `2024.10.1` (28 oct 2024).

### Gaps de evidencia (no verificados en esta investigación)

- Compatibilidad de `better-sqlite3-multiple-ciphers` con `drizzle-orm` (`drizzle-orm/better-sqlite3`) — no se encontró documentación oficial que confirme o descarte el uso del fork como driver de Drizzle; se asume compatible por tener la misma superficie de API que `better-sqlite3`, pero debe validarse empíricamente en la Fase 0.
- Estado de mantenimiento y paridad de API exactas de `sqlcipher3` / `sqlcipher3-binary` (alternativas a `rotki-pysqlcipher3`) — no se consultaron directamente; la Fase 0 debe comparar las opciones antes de fijar una.
- No se verificó si `PRAGMA key` puede aplicarse después de `PRAGMA query_only = ON` en `sqlite-telemetry-reader.ts` sin error — a confirmar en la Fase 2/3.
