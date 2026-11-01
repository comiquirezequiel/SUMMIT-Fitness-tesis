import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { coincide } from './comun';

const MAX_RESULTADOS = 8;

/**
 * Buscador de socios por nombre, DNI o email. Muestra la lista mientras se escribe;
 * con un socio elegido muestra su tarjeta y el botón "Cambiar".
 * socios: lista de GET /socios. detalle(socio): texto opcional debajo del nombre.
 */
const BuscadorSocio = ({ socios, cargando, error, seleccionado, onSeleccionar, detalle, placeholder = 'Buscar socio por nombre, DNI o email...', permitirCambiar = true }) => {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const cajaRef = useRef(null);

  useEffect(() => {
    const cerrar = (e) => { if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  if (seleccionado) {
    return (
      <div className="flex items-center gap-3 p-3 bg-blue-50/60 border border-blue-100 rounded-xl">
        <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 font-semibold text-xs flex items-center justify-center shrink-0">
          {seleccionado.nombreCompleto.substring(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800 truncate">{seleccionado.nombreCompleto}</p>
          <p className="text-xs text-slate-500 truncate">
            {seleccionado.dni ? `DNI ${seleccionado.dni}` : ''}{detalle ? ` · ${detalle(seleccionado)}` : ''}
          </p>
        </div>
        {permitirCambiar && (
          <button onClick={() => { onSeleccionar(null); setTexto(''); }}
            className="text-sm font-semibold text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 tactil:px-3 tactil:min-h-11 rounded-lg shrink-0">
            Cambiar
          </button>
        )}
      </div>
    );
  }

  const resultados = texto.trim()
    ? socios.filter((s) => coincide(texto, s.nombreCompleto, s.dni, s.email)).slice(0, MAX_RESULTADOS)
    : socios.slice(0, MAX_RESULTADOS);

  const elegir = (socio) => {
    onSeleccionar(socio);
    setAbierto(false);
    setTexto('');
  };

  const teclas = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo((i) => Math.min(i + 1, resultados.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && resultados[activo]) { e.preventDefault(); elegir(resultados[activo]); }
    if (e.key === 'Escape') setAbierto(false);
  };

  return (
    <div className="relative" ref={cajaRef}>
      {/* En el celular y la tablet: letra de 16 px (si no, el iPhone agranda la pantalla) y 44 px para el dedo */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(0); }}
          onFocus={() => setAbierto(true)}
          onKeyDown={teclas}
          placeholder={placeholder}
          aria-label="Buscar socio"
          className="w-full pl-8 pr-10 py-1.5 tactil:min-h-11 bg-slate-50 border border-slate-200 rounded-xl text-sm tactil:text-base focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white"
        />
        {cargando && <Loader2 className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />}
        {!cargando && texto && (
          <button onClick={() => setTexto('')} className="absolute right-0 top-0 h-full w-8 tactil:w-11 flex items-center justify-center text-slate-500 hover:text-slate-600" aria-label="Borrar búsqueda">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {abierto && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {error ? (
            <p className="px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : cargando ? (
            <p className="px-3 py-2 text-sm text-slate-500">Cargando socios...</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">
              {socios.length === 0 ? 'No hay socios registrados.' : 'Ningún socio coincide con la búsqueda.'}
            </p>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto">
              {resultados.map((s, i) => (
                <li key={s.idSocio} role="option" aria-selected={i === activo}>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => elegir(s)}
                    onMouseEnter={() => setActivo(i)}
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-3 ${i === activo ? 'bg-blue-50' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-slate-800 block truncate">{s.nombreCompleto}</span>
                      <span className="text-xs text-slate-500">DNI {s.dni}{detalle ? ` · ${detalle(s)}` : ''}</span>
                    </span>
                    {s.estado && s.estado !== 'ACTIVO' && (
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600 shrink-0">{s.estado}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default BuscadorSocio;
