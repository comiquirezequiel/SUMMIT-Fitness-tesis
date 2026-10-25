import colors from 'tailwindcss/colors'

// Color que sale de una variable CSS definida en index.css (el portal del socio la cambia en modo oscuro)
const variable = (nombre) => `rgb(var(--${nombre}) / <alpha-value>)`
// Los tonos indicados de una paleta pasan a ser variables; el resto queda fijo
const conVariables = (paleta, nombre, tonos) => ({
  ...paleta,
  ...Object.fromEntries(tonos.map((tono) => [tono, variable(`${nombre}-${tono}`)])),
})

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // MODO OSCURO del portal del socio (index.css, html.tema-portal): se invierten los grises, los tonos claros
        // que se usan de fondo y borde (50 a 200) y los oscuros que se usan como texto (700 a 900). Los tonos medios,
        // que se usan de relleno con texto blanco (botones bordó, tarjeta roja o verde), quedan fijos. Fuera del
        // portal (panel del personal, login) las variables valen siempre lo mismo que los colores originales.
        slate: conVariables(colors.slate, 'slate', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        rose: conVariables(colors.rose, 'rose', [50, 100, 200, 700, 800, 900]),
        emerald: conVariables(colors.emerald, 'emerald', [50, 100, 200, 700, 800, 900]),
        amber: conVariables(colors.amber, 'amber', [50, 100, 200, 700, 800, 900]),
        // Fondo de tarjetas y paneles: blanco en modo claro (en el portal se usa en lugar de bg-white)
        superficie: variable('superficie'),
        // Texto en color de marca: bordó en modo claro y rosado claro en oscuro (el bordó no se lee sobre oscuro)
        acento: variable('acento'),
        // Colores de la marca: bordó oscuro y bronce. Para texto: blanco sobre bordo-700 (12:1), bronce-300 sobre
        // bordo-700 (5,3:1) y bronce-700 sobre blanco (5,8:1). bronce-500 es el bronce clásico: solo decorativo
        // (íconos, bordes), porque como texto no llega al contraste mínimo (3,1:1 sobre blanco).
        bordo: conVariables({
          50: '#FBF3F5', 100: '#F5E1E6', 200: '#EBC3CD', 300: '#DA97A8', 400: '#C2617A', 500: '#A33654',
          600: '#861D3A', 700: '#6B1027', 800: '#4A0B1B', 900: '#330812', 950: '#1C0A10',
        }, 'bordo', [50, 100, 200, 300, 400]),
        bronce: conVariables({
          50: '#FBF6EF', 100: '#F5E9D7', 200: '#EBD2AE', 300: '#D9A066', 400: '#D38F4C', 500: '#CD7F32',
          600: '#AD6A2B', 700: '#8C5A24', 800: '#6E4720', 900: '#57391B', 950: '#301E0E',
        }, 'bronce', [50, 100, 200, 800, 900]),
      },
    },
  },
  plugins: [],
}
