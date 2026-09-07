import { defineConfig } from 'tsup'

/**
 * One pass, so every entry shares a single declaration graph.
 *
 * Splitting client and server entries into two passes seems tempting (it lets
 * you put a `"use client"` banner on only some of them) but each pass emits its
 * own dts chunk, which means two separate `PlaybackClock` class declarations.
 * TypeScript compares classes with private members nominally, so consumers then
 * get "Types have separate declarations of a private property" when they pass a
 * clock from `./core` into `PlayerProvider` from `./hooks`.
 *
 * The `"use client"` directives are added afterwards by
 * `scripts/add-client-directive.mjs` instead — see `package.json`'s build
 * script. esbuild strips top-of-file directives while bundling, so they cannot
 * survive on their own.
 */
export default defineConfig({
  entry: {
    index: 'index.ts',
    'base/index': 'base/index.ts',
    'core/index': 'core/index.ts',
    'hooks/index': 'hooks/index.ts',
    'ui/index': 'ui/index.ts',
  },
  format: ['esm', 'cjs'],
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.mjs' }),
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  platform: 'browser',
  external: [
    'react',
    'react-dom',
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    '@base-ui/react',
    'urdf-loader',
    'uplot',
    'motion',
    'lucide-react',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
  ],
  injectStyle: false,
})
