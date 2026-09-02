import { defineConfig } from 'tsup'
import { sharedOptions } from './tsup.shared'

/**
 * Server-safe entries: pure TypeScript, no React state, no DOM ownership.
 * These must NOT carry a "use client" directive — they stay importable from
 * React Server Components and plain Node.
 *
 * The client entries are built by `tsup.client.config.ts` in a second, separate
 * pass. Two passes rather than one array config because only this pass may
 * `clean` the output folder; running both concurrently races the shared `dist/`
 * and the dts rollup fails on files that were just deleted.
 */
export default defineConfig({
  ...sharedOptions,
  entry: {
    'core/index': 'core/index.ts',
    'base/index': 'base/index.ts',
  },
  clean: true,
})
