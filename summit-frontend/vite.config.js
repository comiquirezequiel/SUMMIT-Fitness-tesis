import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // El frontend le habla al backend por /api en su misma dirección: en desarrollo, Vite lo deriva al 8080.
    // Así funciona igual en la PC y en el celular a través del túnel HTTPS.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        // Le pasa al backend la IP real de quien pide (la usa el limitador de pedidos)
        xfwd: true,
        // Para el navegador el pedido es del mismo sitio. Sin el encabezado Origin, el backend no lo trata como
        // un pedido de otro sitio (CORS) y no lo rechaza cuando llega desde la dirección del túnel.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
        },
      },
    },
    // Direcciones desde las que Vite acepta pedidos además de localhost: el túnel para probar en el celular
    allowedHosts: ['.trycloudflare.com'],
  },
})
