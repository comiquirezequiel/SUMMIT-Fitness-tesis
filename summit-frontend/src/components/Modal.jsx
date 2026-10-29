import React from 'react';
import { X } from 'lucide-react';

/**
 * Ventana modal reutilizable. "pie" recibe los botones de acción.
 */
const Modal = ({ titulo, subtitulo, onClose, children, pie, ancho = 'max-w-lg' }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm"
    onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    {/* dvh: en el celular, el alto que queda visible con las barras del navegador (vh incluye lo que tapan) */}
    <div className={`bg-white rounded-2xl shadow-xl w-full ${ancho} max-h-[90vh] supports-[height:100dvh]:max-h-[90dvh] flex flex-col`} role="dialog" aria-modal="true">
      <div className="flex justify-between items-start gap-4 p-5 border-b border-slate-100">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-800">{titulo}</h3>
          {subtitulo && <p className="text-sm text-slate-500 mt-0.5">{subtitulo}</p>}
        </div>
        {/* En el celular y la tablet, 44 px para el dedo sin mover el título */}
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 tactil:p-3 tactil:-m-2 rounded-lg hover:bg-slate-100 shrink-0" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5 overflow-y-auto">{children}</div>
      {pie && <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap justify-end gap-3">{pie}</div>}
    </div>
  </div>
);

export default Modal;
