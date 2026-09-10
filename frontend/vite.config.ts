import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En dev, Vite corre en :5173 y proxea /api y /storage al back (:3001) —
// un solo origen lógico para el navegador, sin headaches de CORS.
// /storage/documentos es donde el back guarda vouchers/contratos
// (express.static) — sin este proxy, el link "Ver" del front pega contra
// :5173 en vez de :3001 y da 404. En prod, el build estático
// (`npm run build` -> dist/) lo sirve el propio Express con
// express.static, así que el proxy no aplica (mismo origen).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/storage': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
