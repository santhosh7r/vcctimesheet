import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  build: {
    // The remaining ~840 kB chunk is application code: every route is imported
    // eagerly by App.jsx, so splitting vendors out helps caching but not the
    // initial payload. Getting under 500 kB means lazy-loading routes with
    // React.lazy + Suspense — a real change, not a config tweak. Until that
    // happens, raise the threshold so the warning reflects the actual target
    // rather than firing on every build.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split the heavy third-party libraries out of the app bundle. xlsx and
        // docxtemplater are only needed for export/report screens, so keeping
        // them separate means the login page and dashboards don't pay for them.
        //
        // Vite 8 bundles with rolldown, which requires manualChunks to be a
        // function — the object form throws "manualChunks is not a function".
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('xlsx')) return 'xlsx';
          if (/docxtemplater|pizzip|file-saver/.test(id)) return 'docx';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('@supabase')) return 'supabase';
          if (/[\\/]react(-dom|-router-dom)?[\\/]/.test(id)) return 'react';
        },
      },
    },
  },
})
