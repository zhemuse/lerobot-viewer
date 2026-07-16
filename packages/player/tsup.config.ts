import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'index.ts',
    'base/index': 'base/index.ts',
    'core/index': 'core/PlaybackClock.ts',
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
