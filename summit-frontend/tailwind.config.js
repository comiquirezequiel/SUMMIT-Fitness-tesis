/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Colores de la marca: bordó oscuro y bronce. Para texto: blanco sobre bordo-700 (12:1), bronce-300 sobre
      // bordo-700 (5,3:1) y bronce-700 sobre blanco (5,8:1). bronce-500 es el bronce clásico: solo decorativo
      // (íconos, bordes), porque como texto no llega al contraste mínimo (3,1:1 sobre blanco).
      colors: {
        bordo: {
          50: '#FBF3F5', 100: '#F5E1E6', 200: '#EBC3CD', 300: '#DA97A8', 400: '#C2617A', 500: '#A33654',
          600: '#861D3A', 700: '#6B1027', 800: '#4A0B1B', 900: '#330812', 950: '#1C0A10',
        },
        bronce: {
          50: '#FBF6EF', 100: '#F5E9D7', 200: '#EBD2AE', 300: '#D9A066', 400: '#D38F4C', 500: '#CD7F32',
          600: '#AD6A2B', 700: '#8C5A24', 800: '#6E4720', 900: '#57391B', 950: '#301E0E',
        },
      },
    },
  },
  plugins: [],
}
