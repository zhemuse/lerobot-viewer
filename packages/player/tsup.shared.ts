import type { Options } from 'tsup'

/** Build options shared by the server-safe and client bundles. */
export const sharedOptions: Options = {
  format: ['esm', 'cjs'],
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.mjs' }),
  dts: true,
  sourcemap: true,
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
}
