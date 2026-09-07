import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** Single source of truth for the version shown on the site: the app being downloaded. */
const desktopPackage = JSON.parse(
  readFileSync(new URL('../lerobot-viewer/package.json', import.meta.url), 'utf8'),
)

export default defineConfig({
  base: '/lerobot-viewer/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(desktopPackage.version),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
