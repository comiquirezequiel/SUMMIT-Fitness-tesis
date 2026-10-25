import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Los archivos que solo usa el panel del personal llevan el prefijo panel-: la app del socio no los precarga
// (ver injectManifest.globIgnores). Para saber cuáles son, se recorren los imports desde la entrada de la app sin
// seguir las pantallas del panel que App.jsx descarga recién cuando se abren (las de src/pages y src/components).
// Un archivo con módulos de src es del panel si ninguno de ellos quedó en ese recorrido; sus librerías no cuentan: el
// índice de lucide-react importa todos los íconos, aunque el build después deja solo los que se usan. Rollup junta
// en un mismo archivo solo módulos que necesitan las mismas pantallas, así que los íconos y librerías que comparten
// archivo con una pantalla del panel también son solo del panel. Un archivo hecho solo de librerías (por ejemplo, la
// de los PDF, que usan varias pantallas del panel) es del panel si la app del socio no llega a ninguna.
const PANTALLAS = /[\\/]src[\\/]App\.jsx$/
const PANTALLA_DEL_PANEL = /[\\/]src[\\/](pages|components)[\\/]/
const DE_SRC = /[\\/]src[\\/]/

// Módulos (de src y librerías) que puede necesitar la app del socio (los llena recorridoDelSocio antes de nombrar
// los archivos)
const delSocio = new Set()
const recorridoDelSocio = () => ({
  name: 'summit-recorrido-del-socio',
  apply: 'build',
  buildEnd() {
    delSocio.clear()
    const pendientes = [...this.getModuleIds()].filter((id) => this.getModuleInfo(id)?.isEntry)
    while (pendientes.length) {
      const id = pendientes.pop()
      if (delSocio.has(id)) continue
      delSocio.add(id)
      const info = this.getModuleInfo(id)
      if (!info) continue
      const diferidos = PANTALLAS.test(id)
        ? info.dynamicallyImportedIds.filter((dinamico) => !PANTALLA_DEL_PANEL.test(dinamico))
        : info.dynamicallyImportedIds
      pendientes.push(...info.importedIds, ...diferidos)
    }
  },
})
const archivoDelPanel = (chunk) => {
  const propios = chunk.moduleIds.filter((id) => DE_SRC.test(id) && !id.includes('node_modules') && !id.startsWith('\0'))
  if (propios.length > 0) return !propios.some((id) => delSocio.has(id))
  return chunk.moduleIds.length > 0 && !chunk.moduleIds.some((id) => delSocio.has(id))
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    recorridoDelSocio(),
    // App instalable (PWA): manifiesto, íconos y service worker propio (src/sw.js), que precarga la app para
    // que abra sin conexión y recibe las notificaciones
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // Una versión nueva se aplica cuando la persona toca "Actualizar" (components/AvisoActualizacion.jsx),
      // nunca en medio de una rutina. El registro lo hace ese componente.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'SUMMIT',
        short_name: 'SUMMIT',
        description: 'Tu gimnasio en el celular: rutina, clases e ingreso.',
        lang: 'es-AR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#4A0B1B',
        theme_color: '#4A0B1B',
        // Generados con npm run generar-iconos (pwa-assets.config.js)
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Los íconos ya entran por globPatterns: sin esto, los del manifiesto quedaban dos veces en la precarga
      includeManifestIcons: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        globIgnores: ['**/panel-*.js'],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: (chunk) => (archivoDelPanel(chunk)
          ? 'assets/panel-[name]-[hash].js'
          : 'assets/[name]-[hash].js'),
      },
    },
  },
  server: {
    // El frontend le habla al backend por /api en su misma dirección: en desarrollo, Vite lo deriva al 8080.
    // Así funciona igual en la PC y en el celular a través del túnel HTTPS.
    proxy: {
      '/api': {
        // SUMMIT_BACKEND_URL: otro backend (por ejemplo, uno de prueba en otro puerto); por defecto, el de la PC
        target: process.env.SUMMIT_BACKEND_URL || 'http://localhost:8080',
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
