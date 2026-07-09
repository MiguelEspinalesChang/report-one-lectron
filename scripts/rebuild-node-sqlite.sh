#!/usr/bin/env bash
# rebuild-node-sqlite.sh
# Restores better-sqlite3 to a plain Node.js build after electron-rebuild.
# Run this after `pnpm rebuild:electron` and before `pnpm test`.
#
# Why: electron-rebuild overwrites the native binary with an Electron-ABI build.
# pnpm's virtual store caches it, so `pnpm install --force` doesn't re-run the
# build script. Instead, we delete the binary and run prebuild-install directly
# to fetch the Node-ABI prebuild from GitHub.
#
# Paths are resolved dynamically (no hardcoded versions) so the script
# survives version bumps of better-sqlite3 and prebuild-install.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Resolve the real better-sqlite3 package dir from a workspace that depends on it.
SQLITE_PKG="$(cd "$ROOT/packages/core" && node -p "require('node:path').dirname(require.resolve('better-sqlite3/package.json'))")"

if [ ! -d "$SQLITE_PKG" ]; then
  echo "better-sqlite3 not found. Run pnpm install first."
  exit 1
fi

# prebuild-install is a dependency of better-sqlite3 — resolve it from there.
PREBUILD_INSTALL="$(cd "$SQLITE_PKG" && node -p "require.resolve('prebuild-install/bin.js')")"

BINARY="$SQLITE_PKG/build/Release/better_sqlite3.node"

echo "Removing Electron-ABI binary..."
rm -f "$BINARY"

echo "Fetching Node-ABI prebuild..."
cd "$SQLITE_PKG"
node "$PREBUILD_INSTALL"

echo "Done. better-sqlite3 is now built for Node.js $(node --version) (MODULE_VERSION $(node -p 'process.versions.modules')), ready for vitest."
