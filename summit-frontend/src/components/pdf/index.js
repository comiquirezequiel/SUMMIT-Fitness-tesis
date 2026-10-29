// Base de los PDF del panel: generar, descargar, compartir e imprimir. Este archivo es liviano: la librería
// (@react-pdf/renderer) y los documentos se descargan recién cuando alguien genera un PDF, así las pantallas no
// pesan más. Los documentos (RutinaPdf.jsx y los que vengan) se diseñan con marca.js y Membrete.jsx.
//
// Un "documento" es un objeto con:
// - cargar: () => import('./RutinaPdf')   el módulo con el componente <Document> como export default
// - datos: objeto o función async        las props del componente (la función se llama al generar)
// - nombreArchivo: 'Rutina Juan Pérez.pdf'
// - titulo, texto (opcionales)            lo que acompaña al archivo al compartirlo
// El PDF de un mismo objeto se genera una sola vez: si se toca "Descargar" y después "Compartir", se reusa.
import { createElement } from 'react';
import { apiFetch } from '../../services/api';

const generados = new WeakMap();

/** Genera el PDF (Blob). Las pantallas no lo necesitan: usan descargarPdf, compartirPdf o imprimirPdf. */
export const generarPdf = (documento) => {
  if (!generados.has(documento)) {
    const promesa = (async () => {
      const [{ pdf }, modulo, datos] = await Promise.all([
        import('@react-pdf/renderer'),
        documento.cargar(),
        typeof documento.datos === 'function' ? documento.datos() : documento.datos,
      ]);
      return pdf(createElement(modulo.default, datos)).toBlob();
    })();
    // Si falla (por ejemplo, sin conexión al bajar la librería), el próximo intento vuelve a probar
    promesa.catch(() => generados.delete(documento));
    generados.set(documento, promesa);
  }
  return generados.get(documento);
};

const nombreDe = (documento) => (documento.nombreArchivo || 'documento.pdf').replace(/[\\/:*?"<>|]+/g, '-').trim();

const bajar = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

/** Celular o tablet: el dedo es el puntero principal (en una PC con pantalla táctil manda el mouse) */
export const esTactil = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);

/** true si el navegador puede compartir archivos PDF (Web Share API con archivos) */
export const puedeCompartirArchivos = () => {
  try {
    return Boolean(navigator.canShare?.({ files: [new File(['%PDF'], 'prueba.pdf', { type: 'application/pdf' })] }));
  } catch {
    return false;
  }
};

/** Descarga el PDF con su nombre. Devuelve 'descargado'. */
export const descargarPdf = async (documento) => {
  bajar(await generarPdf(documento), nombreDe(documento));
  return 'descargado';
};

/**
 * Abre el menú de compartir del celular con el archivo (WhatsApp, mail, Drive, imprimir en el iPhone...).
 * Devuelve:
 * - 'compartido' o 'cancelado' (la persona cerró el menú)
 * - 'descargado': el navegador no comparte archivos, así que se descargó para mandarlo desde la app
 * - 'tocar-de-nuevo': el PDF tardó en generarse y el navegador ya no acepta abrir el menú sin otro toque.
 *   Queda generado: el próximo compartirPdf con el mismo documento lo abre al instante.
 */
export const compartirPdf = async (documento) => {
  const blob = await generarPdf(documento);
  const archivo = new File([blob], nombreDe(documento), { type: 'application/pdf' });
  if (!navigator.canShare?.({ files: [archivo] })) {
    bajar(blob, archivo.name);
    return 'descargado';
  }
  // Compartir solo se permite poco después de un toque
  if (navigator.userActivation && !navigator.userActivation.isActive) return 'tocar-de-nuevo';
  try {
    await navigator.share({
      files: [archivo],
      ...(documento.titulo && { title: documento.titulo }),
      ...(documento.texto && { text: documento.texto }),
    });
    return 'compartido';
  } catch (e) {
    if (e.name === 'AbortError') return 'cancelado';
    if (e.name === 'NotAllowedError') return 'tocar-de-nuevo';
    throw e;
  }
};

const esSafari = () => /^((?!chrome|chromium|crios|fxios|android|edg).)*safari/i.test(navigator.userAgent);

/**
 * Imprime el PDF. En la PC abre el diálogo de impresión del navegador sobre el PDF ('impreso'). En el celular, la
 * tablet y Safari lo abre en una pestaña, desde donde se imprime o se comparte ('abierto'); si el navegador bloquea
 * la pestaña, lo descarga ('descargado'). Llamarla directo desde el toque: la pestaña se abre antes de generar el PDF.
 */
export const imprimirPdf = async (documento) => {
  const enPestana = esTactil() || esSafari();
  // Antes de cualquier espera: pasado el toque, el navegador bloquea las pestañas nuevas
  const pestana = enPestana ? window.open('', '_blank') : null;
  try {
    pestana?.document.write('<p style="font:16px system-ui,sans-serif;padding:24px">Preparando el PDF…</p>');
    pestana?.document.close();
  } catch {
    // si no se puede escribir en la pestaña, queda en blanco hasta que llega el PDF
  }
  let blob;
  try {
    blob = await generarPdf(documento);
  } catch (e) {
    pestana?.close();
    throw e;
  }
  const url = URL.createObjectURL(blob);
  if (enPestana) {
    if (!pestana) {
      URL.revokeObjectURL(url);
      bajar(blob, nombreDe(documento));
      return 'descargado';
    }
    pestana.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60000);
    return 'abierto';
  }
  // PC: el visor de PDF del navegador en un marco invisible, y su diálogo de impresión
  await new Promise((resolve, reject) => {
    const marco = document.createElement('iframe');
    marco.setAttribute('aria-hidden', 'true');
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    marco.onload = () => {
      try {
        marco.contentWindow.focus();
        marco.contentWindow.print();
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    marco.src = url;
    document.body.appendChild(marco);
    // El marco queda un rato: algunos navegadores leen el PDF mientras el diálogo está abierto
    setTimeout(() => { marco.remove(); URL.revokeObjectURL(url); }, 10 * 60000);
  });
  return 'impreso';
};

// ---- Datos para los documentos ----

const MINUTOS_GIMNASIO = 5;
let gimnasio = { datos: null, hasta: 0 };

/**
 * Datos del gimnasio para el membrete (GET /api/configuracion/gimnasio), guardados unos minutos. Si no se pueden
 * leer (sin conexión), devuelve null y el PDF sale sin ellos.
 */
export const datosDelGimnasio = async () => {
  if (gimnasio.datos && Date.now() < gimnasio.hasta) return gimnasio.datos;
  try {
    const res = await apiFetch('/configuracion/gimnasio');
    if (!res.ok) return gimnasio.datos;
    gimnasio = { datos: await res.json(), hasta: Date.now() + MINUTOS_GIMNASIO * 60000 };
  } catch {
    // sin conexión: queda lo último que se leyó (o nada)
  }
  return gimnasio.datos;
};

/**
 * Prepara una imagen para un PDF (por ejemplo, el logo del gimnasio): la baja y la pasa a PNG (data URL), porque la
 * librería solo acepta PNG y JPG. Sirve cualquier formato que muestre el navegador (WebP, SVG...). Las direcciones
 * /api/... van con la sesión. Devuelve null si no se puede (el PDF sale sin la imagen).
 */
export const imagenParaPdf = async (url, ladoMaximo = 512) => {
  if (!url) return null;
  let objeto = null;
  try {
    const res = url.startsWith('/api/') ? await apiFetch(url.slice(4)) : await fetch(url);
    if (!res.ok) return null;
    objeto = URL.createObjectURL(await res.blob());
    const imagen = await new Promise((resolver, rechazar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = rechazar;
      img.src = objeto;
    });
    // Un SVG sin tamaño propio se dibuja al tamaño máximo
    const ancho = imagen.naturalWidth || ladoMaximo;
    const alto = imagen.naturalHeight || ladoMaximo;
    const escala = Math.min(1, ladoMaximo / Math.max(ancho, alto));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(ancho * escala);
    lienzo.height = Math.round(alto * escala);
    lienzo.getContext('2d').drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    if (objeto) URL.revokeObjectURL(objeto);
  }
};
