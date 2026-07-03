# Installer

Not configured yet. Planned pipeline:

1. `pnpm build` — Vue bundle, core typecheck, Electron main/preload bundles.
2. PyInstaller — package `apps/python-service` (with pymodbus and serial
   drivers) into a self-contained runtime shipped under `resources/`.
3. electron-builder — `Setup.exe` (Windows), `AppImage`/`.deb` (Linux).

Define and test the PyInstaller packaging early: it is the most painful part
of distribution.
