import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Fixed dev port so the main app's "Client Portal" button can link here in dev.
  server: { port: 5174, strictPort: true },
})
