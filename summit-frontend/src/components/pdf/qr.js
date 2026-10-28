// Código QR para los PDF, como trazo vectorial (nítido al imprimir): se dibuja con QRCodeSVG (qrcode.react) fuera de
// la pantalla y se toma su trazo. Se carga recién al generar un PDF que lo usa (factura.js).
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { QRCodeSVG } from 'qrcode.react';

/** { viewBox, d } para dibujarlo con <Svg> y <Path> de @react-pdf/renderer, o null si no hay texto. */
export const qrParaPdf = (texto) => {
  if (!texto) return null;
  const contenedor = document.createElement('div');
  const raiz = createRoot(contenedor);
  try {
    flushSync(() => raiz.render(createElement(QRCodeSVG, { value: texto, level: 'M', marginSize: 0 })));
    const svg = contenedor.querySelector('svg');
    const trazos = svg ? svg.querySelectorAll('path') : [];
    // El primer trazo es el fondo blanco; el segundo, los módulos negros
    return trazos.length < 2 ? null : { viewBox: svg.getAttribute('viewBox'), d: trazos[1].getAttribute('d') };
  } finally {
    raiz.unmount();
  }
};
