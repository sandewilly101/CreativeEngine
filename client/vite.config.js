import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Listen on IPv4 and IPv6. Vite otherwise binds [::1] only, so anything
    // reaching the dev server over 127.0.0.1 gets a refused connection.
    host: true,
    proxy: {
      // 127.0.0.1, not localhost: on Windows localhost can resolve to ::1
      // first and the proxy then fails to reach the API, surfacing as a 500.
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:4000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
