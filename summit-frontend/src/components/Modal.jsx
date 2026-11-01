import { X } from 'lucide-react';

/**
 * Ventana modal reutilizable. "pie" recibe los botones de acción; "extra", algo para la derecha del título (por
 * ejemplo, los botones del PDF). alto: una clase de alto fijo (h-[92dvh]) para las ventanas grandes que no deben
 * cambiar de tamaño mientras se cargan.
 */
const Modal = ({ titulo, subtitulo, onClose, children, pie, extra, ancho = 'max-w-lg', alto = '' }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-gray-900/50 backdrop-blur-xs"
    onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    {/* dvh: en el celular, el alto que queda visible con las barras del navegador (vh incluye lo que tapan) */}
    <div className={`bg-white rounded-xl shadow-xl w-full ${ancho} ${alto} max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh] flex flex-col`} role="dialog" aria-modal="true">
      <div className="flex justify-between items-start gap-3 px-4 py-3 border-b border-slate-100">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-800 leading-snug">{titulo}</h3>
          {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
        </div>
        {extra && <div className="shrink-0">{extra}</div>}
        {/* En el celular y la tablet, 44 px para el dedo sin mover el título */}
        <button onClick={onClose} className="text-slate-500 hover:text-slate-600 p-1 tactil:p-3 tactil:-m-2 rounded-lg hover:bg-slate-100 shrink-0" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-4 overflow-y-auto flex-1">{children}</div>
      {pie && <div className="px-4 py-2.5 border-t border-slate-100 flex flex-wrap justify-end gap-2">{pie}</div>}
    </div>
  </div>
);

export default Modal;
