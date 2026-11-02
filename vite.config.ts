import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site from /LiftLab/; dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/LiftLab/' : '/',
  plugins: [react(), tailwindcss()],
}))
