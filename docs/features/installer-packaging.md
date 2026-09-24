# Feature: Instalador autocontenido (cero prerequisitos en la máquina destino)

> Estado: **DEFINIDO — pendiente de implementación**
> Objetivo: un instalador (`.exe`/`.dmg`) que corre en cualquier máquina **sin Node, sin Python, sin nada preinstalado**.
> Documentos normativos: `docs/ARCHITECTURE.md`, `docs/PYTHON-DB.md`

## La respuesta corta

Sí, es totalmente posible, y es el modelo estándar de distribución de apps Electron con sidecars:

| Runtime | ¿La máquina destino lo necesita? | Por qué |
|---|---|---|
| Node.js | **NO** | Electron embebe su propio Node + Chromium dentro del ejecutable |
| Python | **NO** | El sidecar se congela con PyInstaller: binario autocontenido con el intérprete adentro |
| SQLite | **NO** | `better-sqlite3` compila SQLite estáticamente; Python congelado lleva su propio `sqlite3` |
| Módulos nativos | **NO** | `better-sqlite3` (≥ 13) y `argon2` son N-API prebuilt y viajan dentro del paquete |

## Decisión de stack

- **electron-builder** para el empaquetado y el instalador (NSIS en Windows, DMG en macOS).
- **PyInstaller en modo `onedir`** para el sidecar Python (arranque más rápido y menos falsos positivos de antivirus que `onefile`).
- Los recursos que no son código JS (sidecar congelado, migraciones SQL) viajan como `extraResources` → quedan en `process.resourcesPath`.

## Estado verificado HOY (los 6 huecos)

| # | Hueco | Evidencia | Solución definida |
|---|---|---|---|
| 1 | No hay tooling de instalador | `apps/electron/package.json` → script `installer` es un `echo` placeholder | Config `electron-builder.yml` + electron-builder como devDependency |
| 2 | Python cae al `python3` del sistema | `packages/core/src/python-bridge/resolve-python.ts` (fallback final) | PyInstaller congela `main.py` → `PythonManager` en modo empaquetado spawnea el binario directo (sin resolver intérprete) |
| 3 | Migraciones de `app.db` se resuelven relativo al fuente | `apps/electron/main/index.ts` — `TODO(installer)` explícito, `__dirname/../../../../database/migrations/app` | `extraResources: database/migrations/app` + resolver vía `process.resourcesPath` cuando `app.isPackaged` |
| 4 | El renderer se carga con path relativo al monorepo | `apps/electron/main/window.ts` — `loadFile('../../../frontend/dist/index.html')` | Incluir `apps/frontend/dist` en `files` del builder con layout que preserve esa ruta relativa (o copiar a `dist/renderer` y ajustar el path) |
| 5 | ~~`better-sqlite3` necesita ABI de Electron~~ | Resuelto: better-sqlite3 13 es N-API (ver `docs/features/done/dependency-security-patch.md`) | Sin recompilación; ambos nativos van en `asarUnpack` (desactivar `npmRebuild` de electron-builder si intentara recompilar) |
| 6 | El sidecar congelado no existe | `python-manager.ts` espera `process.resourcesPath/python-service` pero nada lo genera | Paso de build `pyinstaller` que emite a `apps/python-service/dist/` y el builder lo copia como `extraResources` |

## Diseño del pipeline de build

```
pnpm build                    # typecheck + vite build + esbuild main/preload (ya existe)
pyinstaller (onedir)          # congela el sidecar → apps/python-service/dist/python-service/
electron-builder              # arma asar (nativos N-API en asarUnpack), copia extraResources,
                              # genera el instalador por plataforma
```

Layout resultante dentro de la app instalada:

```
Resources/
├── app.asar                  # main + preload bundleados, frontend dist
├── app.asar.unpacked/        # better-sqlite3, argon2 (nativos no van dentro del asar)
├── python-service/           # sidecar CONGELADO (binario + libs + intérprete embebido)
└── database/migrations/app/  # SQL de migraciones de app.db
```

Cambios de código necesarios (pequeños, todos detrás de `app.isPackaged`):

1. `python-manager.ts`: si `app.isPackaged`, spawnear `process.resourcesPath/python-service/python-service` (binario congelado) en vez de `resolvePythonBin(...) main.py`.
2. `index.ts`: `migrationsFolder = app.isPackaged ? path.join(process.resourcesPath, 'database/migrations/app') : <path actual de dev>`.
3. `window.ts`: apuntar al `index.html` según el layout final elegido.
4. Script `installer` real en `apps/electron/package.json` + `electron-builder.yml`.
5. PyInstaller spec en `apps/python-service` (entry `main.py`; cuando lleguen `pymodbus`/`pyserial`, declararlos como hidden imports si hace falta).

## Restricciones y gotchas conocidos

- **Cada instalador se construye EN su plataforma destino**: el `.exe` en Windows, el `.dmg` en macOS (arm64/x64 según target). Para cubrir ambas: CI con matrix por OS.
- El dict de handlers RPC y `stdout` reservado a JSON-RPC no cambian: el sidecar congelado es el MISMO proceso, solo cambia quién lo lanza.
- `pnpm` + electron-builder: los dos módulos nativos ya son dependencias directas de `apps/electron` (requisito que el bundle CJS ya impuso) — eso es exactamente lo que el builder necesita para incluirlos.
- Firma de código (macOS notarization / Windows signing) queda fuera de este alcance; se define cuando haya certificados.
- El modo dev NO cambia en nada: venv + Vite + electron siguen igual.

## Criterio de aceptación

- [ ] Instalar el artefacto en una máquina limpia (sin Node, sin Python) y que la app abra, cree `app.db`/`telemetry.db` en `userData`, y el ping al sidecar responda.
- [ ] Login con el usuario seed y alta de una marca desde la UI.
- [ ] Poll simulado escribe lecturas en `telemetry.db` (verifica que el sidecar congelado escribe bien).
