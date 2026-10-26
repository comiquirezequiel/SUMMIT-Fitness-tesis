// Marca de los PDF: colores, tipografías y estilos comunes. Lo importan solo los documentos (que se cargan
// diferidos), nunca una pantalla: trae @react-pdf/renderer.
//
// Tipografías: Barlow y Barlow Condensed, de The Barlow Project Authors, con licencia SIL Open Font License 1.1
// (fuentes/OFL.txt). Son los TTF originales de github.com/google/fonts, sin modificar. Cubren todo el español
// (á, é, ñ, ü, ¿, ¡, °, ×). El PDF incluye solo las letras que usa, así que pesa poco.
import { Font, StyleSheet } from '@react-pdf/renderer';
import barlowRegular from './fuentes/Barlow-Regular.ttf';
import barlowItalica from './fuentes/Barlow-Italic.ttf';
import barlowSemiBold from './fuentes/Barlow-SemiBold.ttf';
import barlowBold from './fuentes/Barlow-Bold.ttf';
import condensadaSemiBold from './fuentes/BarlowCondensed-SemiBold.ttf';
import condensadaBold from './fuentes/BarlowCondensed-Bold.ttf';

Font.register({
  family: 'Barlow',
  fonts: [
    { src: barlowRegular, fontWeight: 400 },
    { src: barlowItalica, fontWeight: 400, fontStyle: 'italic' },
    { src: barlowSemiBold, fontWeight: 600 },
    { src: barlowBold, fontWeight: 700 },
  ],
});
Font.register({
  family: 'Barlow Condensed',
  fonts: [
    { src: condensadaSemiBold, fontWeight: 600 },
    { src: condensadaBold, fontWeight: 700 },
  ],
});
// Sin cortar palabras con guiones: la librería trae las reglas del inglés y en español cortaría mal
Font.registerHyphenationCallback((palabra) => [palabra]);

// Colores de tailwind.config.js. El bordó y el bronce van con moderación (encabezado, días, filetes). Los textos
// usan casi negro y un gris oscuro que se leen bien también impresos en blanco y negro.
export const COLORES = {
  bordo: '#4A0B1B', // bordo-800
  bordoMedio: '#6B1027', // bordo-700
  bordoClaro: '#FBF3F5', // bordo-50
  bronce: '#CD7F32', // bronce-500: solo decorativo (filetes)
  bronceTexto: '#8C5A24', // bronce-700: bronce que se lee como texto
  texto: '#1C1917',
  textoSuave: '#57534E', // gris para etiquetas: 7,5:1 sobre blanco
  linea: '#D6D3D1',
  lineaSuave: '#E7E5E4',
  fondoSuave: '#FAF8F7',
  blanco: '#FFFFFF',
};

export const FUENTES = { texto: 'Barlow', titulos: 'Barlow Condensed' };

// A4 vertical. El margen de abajo deja lugar al pie fijo; el de arriba, al encabezado chico de las páginas 2 en adelante
export const MARGENES = { arriba: 46, abajo: 58, costados: 38 };

export const estilosBase = StyleSheet.create({
  pagina: {
    paddingTop: MARGENES.arriba,
    paddingBottom: MARGENES.abajo,
    paddingHorizontal: MARGENES.costados,
    fontFamily: FUENTES.texto,
    // Sin ligaduras (fi, fl): con ellas, al copiar o buscar en el PDF "hipertrofia" sale "hipertrofa"
    fontFeatureSettings: { liga: false },
    fontSize: 10,
    // Sin lineHeight acá (va en cada estilo de texto): en el navegador, con interlineado en la página la librería no
    // escribe los números de página
    color: COLORES.texto,
    backgroundColor: COLORES.blanco,
  },
  etiqueta: {
    fontSize: 7.5,
    fontWeight: 600,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORES.textoSuave,
  },
});

// Emojis y símbolos de los teclados del celular: las tipografías no los tienen y saldrían cuadraditos.
// Incluye a propósito los caracteres que unen emojis (ZWJ, selectores de variante), que ESLint marca como sospechosos
// eslint-disable-next-line no-misleading-character-class
const SIN_LETRA = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;
export const textoPdf = (texto) => (texto === null || texto === undefined ? ''
  : String(texto).replace(SIN_LETRA, '').replace(/[ \t]{2,}/g, ' ').trim());
