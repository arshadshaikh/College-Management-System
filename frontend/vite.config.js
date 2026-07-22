import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        // target: 'http://localhost:8000',
        target: 'http://127.0.0.1:80',
        // changeOrigin: true,
        changeOrigin: false,  // ← preserve the Host header so ResolveTenant sees the subdomain
        secure: false,
        headers: { 'Accept-Encoding': 'identity' },
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});