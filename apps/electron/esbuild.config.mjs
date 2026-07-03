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
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
})
