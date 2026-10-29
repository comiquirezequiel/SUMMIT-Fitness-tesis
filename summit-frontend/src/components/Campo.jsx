
// tactil: (tailwind.config.js) en el celular y la tablet, letra de 16 px en los campos y botones de 44 px de alto
export const inputClass =
  "w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm tactil:text-base text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-shadow placeholder:text-slate-300 disabled:bg-slate-50";

export const botonPrimario =
  "px-4 py-2.5 tactil:min-h-11 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors flex items-center justify-center gap-2";

export const botonSecundario =
  "px-4 py-2.5 tactil:min-h-11 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center gap-2";

/**
 * Etiqueta + control de formulario + ayuda o error.
 */
const Campo = ({ label, required, error, ayuda, children, className = '' }) => (
  <div className={className}>
    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
    {error
      ? <p className="text-xs text-rose-600 mt-1">{error}</p>
      : ayuda && <p className="text-xs text-slate-400 mt-1">{ayuda}</p>}
  </div>
);

export default Campo;
