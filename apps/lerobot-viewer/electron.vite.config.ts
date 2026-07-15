import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@lerobot/lerobot-reader'] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@lerobot/lerobot-reader'] })],
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
