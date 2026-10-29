import { useState } from 'react';
import { Printer, Download, Share2, Loader2 } from 'lucide-react';
import { botonPrimario, botonSecundario } from '../Campo';
import { compartirPdf, descargarPdf, esTactil, imprimirPdf } from './index';

const ACCIONES = { compartir: compartirPdf, descargar: descargarPdf, imprimir: imprimirPdf };

// Qué se le dice a la persona según cómo terminó cada acción (ver index.js)
const avisoDe = (accion, resultado) => {
  if (resultado === 'tocar-de-nuevo') return { tipo: 'info', texto: 'El PDF está listo: tocá Compartir de nuevo para elegir a quién mandarlo.' };
  if (resultado === 'abierto') return { tipo: 'info', texto: 'El PDF se abrió en otra pestaña: imprimilo desde ahí (en el celular, desde el botón Compartir del navegador).' };
  if (resultado === 'descargado' && accion === 'compartir') {
    return { tipo: 'info', texto: 'Este navegador no deja compartir archivos: se descargó el PDF para que lo mandes desde WhatsApp.' };
  }
  if (resultado === 'descargado' && accion === 'imprimir') {
    return { tipo: 'info', texto: 'Se descargó el PDF: abrilo y elegí Imprimir.' };
  }
  return null;
};

/**
 * Botones "Imprimir", "Descargar PDF" y, en el celular o la tablet, "Compartir" (WhatsApp y demás) de un documento
 * PDF (ver index.js). documento: el objeto del documento, armado con useMemo para que el PDF se genere una sola vez
 * mientras los datos no cambien; null lo deshabilita. La primera vez se descarga la librería, así que tarda un poco.
 */
const BotonesPdf = ({ documento, className = '' }) => {
  const [enCurso, setEnCurso] = useState(null);
  const [aviso, setAviso] = useState(null);
  const tactil = esTactil();

  const ejecutar = async (accion) => {
    if (!documento || enCurso) return;
    setEnCurso(accion);
    setAviso(null);
    try {
      setAviso(avisoDe(accion, await ACCIONES[accion](documento)));
    } catch (e) {
      console.error('No se pudo generar el PDF', e);
      setAviso({ tipo: 'error', texto: 'No se pudo generar el PDF. Revisá la conexión e intentá de nuevo.' });
    } finally {
      setEnCurso(null);
    }
  };

  const boton = (accion, texto, Icono, clase) => (
    <button type="button" onClick={() => ejecutar(accion)} disabled={!documento || Boolean(enCurso)}
      className={`${clase} flex-1 sm:flex-none whitespace-nowrap disabled:opacity-60`}>
      {enCurso === accion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icono className="w-4 h-4" />}
      {texto}
    </button>
  );

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {/* En el celular, Compartir va primero y ocupa todo el ancho: es lo que más se usa (mandarla por WhatsApp) */}
        {tactil && boton('compartir', 'Compartir', Share2, `${botonPrimario} basis-full sm:basis-auto`)}
        {boton('imprimir', 'Imprimir', Printer, `${botonSecundario} bg-white`)}
        {boton('descargar', 'Descargar PDF', Download, `${botonSecundario} bg-white`)}
      </div>
      <p className={`text-sm mt-2 ${aviso?.tipo === 'error' ? 'text-rose-600' : 'text-slate-600'} ${enCurso || aviso ? '' : 'sr-only'}`}
        role="status" aria-live="polite">
        {enCurso ? 'Preparando el PDF…' : aviso?.texto}
      </p>
    </div>
  );
};

export default BotonesPdf;
