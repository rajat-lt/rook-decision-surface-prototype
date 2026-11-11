import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base so the build serves from https://rajat-lt.github.io/<repo>/.
  base: './',
  // 5185, the brief's port, is claimed by another entry in launch.json (spec C14).
  server: { port: 5186, strictPort: true },
  preview: { port: 5187, strictPort: true },
})
