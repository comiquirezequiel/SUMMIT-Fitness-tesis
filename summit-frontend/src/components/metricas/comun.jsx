import { Loader2, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../services/api';

// Piezas compartidas por las pestañas de métricas del tablero (Socios, Planes / Membresías y Ganancias)

/** GET que devuelve el JSON o lanza un Error con el mensaje del backend. */
export const pedirMetricas = async (ruta, porDefecto = 'No se pudieron cargar las métricas') => {
  const res = await apiFetch(ruta);
  const json = await res.json().catch(() => ({}));
  if (res.status === 403) throw new Error('Estas métricas son solo para administración.');
  if (!res.ok) throw new Error(json.error || porDefecto);
  return json;
};

/** Mientras llegan los datos de una pestaña: el lugar de la fila de indicadores, para que no salte la pantalla. */
export const CargandoMetricas = () => (
  <div className="h-16 flex items-center justify-center gap-2 text-sm text-slate-500 aparece-tarde" role="status" data-cargando>
    <Loader2 className="w-4 h-4 animate-spin" /> Cargando métricas…
  </div>
);

export const ErrorMetricas = ({ mensaje }) => (
  <p className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium flex items-center gap-2" role="alert">
    <AlertTriangle className="w-4 h-4 shrink-0" /> {mensaje}
  </p>
);

/**
 * Fila de indicadores: de a 2 en el celular, de a 3 en la tablet y todos en una fila en la PC (columnasPc: la clase de
 * Tailwind con cuántos son, escrita entera para que Tailwind la genere).
 */
export const FilaKpis = ({ children, columnasPc = 'xl:grid-cols-6' }) => (
  <div className={`grid grid-cols-2 sm:grid-cols-3 ${columnasPc} gap-2`}>{children}</div>
);

export const decimal = (n) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
