import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // El frontend le habla al backend por /api en su misma dirección: en desarrollo, Vite lo deriva al 8080.
    proxy: {
      '/api': {
        // SUMMIT_BACKEND_URL: otro backend (por ejemplo, uno de prueba en otro puerto); por defecto, el de la PC
        target: process.env.SUMMIT_BACKEND_URL || 'http://localhost:8080',
        // Le pasa al backend la IP real de quien pide (la usa el limitador de pedidos)
        xfwd: true,
        // Para el navegador el pedido es del mismo sitio. Sin el encabezado Origin, el backend no lo trata como
        // un pedido de otro sitio (CORS) y no lo rechaza cuando se entra desde otra PC de la red.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
        },
      },
    },
  },
})
