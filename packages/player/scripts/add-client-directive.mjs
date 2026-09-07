import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Stamp `"use client"` onto the entries that own React state or DOM elements.
 *
 * esbuild drops top-of-file directives when bundling, so the one in
 * PlayerProvider.tsx never reaches dist. Without this, importing
 * `PlayerProvider` from a React Server Component fails at runtime.
 *
 * Only the entry modules are stamped — that is enough. A bundler treats the
 * directive-carrying module as a client boundary, and everything it imports
 * (shared chunks included) joins the client graph from there.
 *
 * `core` and `base` are deliberately left alone: they are pure TypeScript and
 * must stay importable from Server Components and plain Node.
 */
const CLIENT_ENTRIES = [
  'index.mjs',
  'index.cjs',
  'hooks/index.mjs',
  'hooks/index.cjs',
  'ui/index.mjs',
  'ui/index.cjs',
]

const DIRECTIVE = '"use client";'
const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

let stamped = 0
for (const entry of CLIENT_ENTRIES) {
  const file = join(distDir, entry)
  const source = await readFile(file, 'utf8')
  if (source.startsWith(DIRECTIVE) || source.startsWith("'use client'")) continue
  await writeFile(file, `${DIRECTIVE}\n${source}`)
  stamped += 1
}

console.log(`[add-client-directive] stamped ${stamped}/${CLIENT_ENTRIES.length} entries`)
