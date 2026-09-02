import { defineConfig } from 'tsup'
import { sharedOptions } from './tsup.shared'

/**
 * Client entries — anything that owns React state, context, or DOM elements.
 *
 * esbuild strips top-of-file directives when bundling, so the `'use client'` in
 * PlayerProvider.tsx never survives into dist. Re-add it as a banner: marking
 * the entry module is enough, because everything it pulls in (shared chunks
 * included) joins the client graph from that boundary.
 *
 * Runs after `tsup.config.ts`, which owns `clean`.
 */
export default defineConfig({
  ...sharedOptions,
  entry: {
    index: 'index.ts',
    'hooks/index': 'hooks/index.ts',
    'ui/index': 'ui/index.ts',
  },
  clean: false,
  banner: { js: '"use client";' },
})
