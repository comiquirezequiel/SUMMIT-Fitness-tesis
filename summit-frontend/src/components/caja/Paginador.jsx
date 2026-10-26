import React from 'react';

/** Pie de una tabla paginada (respuesta Page de Spring): "Página 1 de 3 · 40 cobros" y Anterior / Siguiente. */
const Paginador = ({ pagina, nombre, onCambiar }) => (pagina && pagina.totalElements > 0 ? (
  <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-sm text-slate-500">
    <span>Página {pagina.number + 1} de {pagina.totalPages} · {pagina.totalElements} {nombre}</span>
    <div className="flex gap-1">
      <button onClick={() => onCambiar(pagina.number - 1)} disabled={pagina.first}
        className="px-3 py-1 border border-slate-200 rounded hover:bg-white transition-colors disabled:opacity-50">Anterior</button>
      <button onClick={() => onCambiar(pagina.number + 1)} disabled={pagina.last}
        className="px-3 py-1 border border-slate-200 rounded hover:bg-white transition-colors disabled:opacity-50">Siguiente</button>
    </div>
  </div>
) : null);

export default Paginador;
