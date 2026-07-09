import { build } from 'esbuild'

await build({
  entryPoints: {
    'main/index': 'main/index.ts',
    'preload/bridge': 'preload/bridge.ts',
  },
  outdir: 'dist',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  // Native N-API/NAN modules must never be bundled: their loaders resolve the
  // .node binary relative to their own __dirname, which breaks inside dist/.
  // They are declared as runtime dependencies of this package instead.
  external: ['electron', 'better-sqlite3', 'argon2'],
  sourcemap: true,
  logLevel: 'info',
  logOverride: {
    // packages/core/src/persistence/adapters/sqlite-database.ts handles the
    // CJS case explicitly (`import.meta.url ?? __filename` + injected
    // migrationsFolder), so this warning is intentional noise here.
    'empty-import-meta': 'silent',
  },
})
