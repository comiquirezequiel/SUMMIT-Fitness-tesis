import { Search } from 'lucide-react';

// tactil: (index.css) en el celular y la tablet, letra de 16 px en los campos y botones de 44 px de alto
export const inputClass =
  "w-full px-2.5 py-1.5 tactil:py-2.5 border border-slate-200 rounded-lg text-sm tactil:text-base text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-shadow placeholder:text-slate-300 disabled:bg-slate-50";

export const botonPrimario =
  "px-3 py-1.5 tactil:min-h-11 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors flex items-center justify-center gap-1.5";

export const botonSecundario =
  "px-3 py-1.5 tactil:min-h-11 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center gap-1.5";

// Barra de herramientas de una tabla o una pestaña (Actualizar, Exportar...): más chicos que los de un formulario
export const botonHerramienta =
  "px-2.5 py-1.5 tactil:min-h-11 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap";

// Desplegable de filtro de una barra de herramientas (mismo alto que botonHerramienta)
export const selectorHerramienta =
  "px-2 py-1.5 tactil:min-h-11 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-100";

/**
 * Campo de búsqueda con la lupa adentro. El ancho lo da className (por ejemplo, w-full sm:w-64).
 */
export const Buscador = ({ valor, onChange, placeholder = 'Buscar...', className = '', etiqueta, ...props }) => (
  <div className={`relative ${className}`}>
    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    <input type="text" value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={etiqueta || placeholder}
      className="w-full pl-8 pr-2.5 py-1.5 tactil:py-2.5 border border-slate-200 rounded-lg text-sm tactil:text-base bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-shadow placeholder:text-slate-400"
      {...props} />
  </div>
);

/**
 * Etiqueta + control de formulario + ayuda o error.
 */
const Campo = ({ label, required, error, ayuda, children, className = '' }) => (
  <div className={className}>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
      {label} {required && <span className="text-rose-700">*</span>}
    </label>
    {children}
    {error
      ? <p className="text-xs text-rose-700 mt-1">{error}</p>
      : ayuda && <p className="text-xs text-slate-500 mt-0.5">{ayuda}</p>}
  </div>
);

export default Campo;
