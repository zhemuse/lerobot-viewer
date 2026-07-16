import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@lerobot-viewer/reader'] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@lerobot-viewer/reader'] })],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
      },
    },
    plugins: [tailwindcss(), react()],
  },
})
