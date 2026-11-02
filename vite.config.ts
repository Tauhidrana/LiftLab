import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site from /LiftLab/; Vercel and dev serve from /.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/LiftLab/' : '/',
  plugins: [react(), tailwindcss()],
})
