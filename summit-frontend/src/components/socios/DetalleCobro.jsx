import { Loader2 } from 'lucide-react';
import { formatMoneda } from '../../utils/formato';

const Fila = ({ texto, children }) => (
  <div className="flex justify-between items-baseline gap-3">
    <span className="text-slate-600 min-w-0">{texto}</span>
    <span className="font-semibold text-slate-800 whitespace-nowrap">{children}</span>
  </div>
);

/**
 * Detalle de un cobro tal como lo calcula el backend: precio del plan, descuento, matrícula y total. Si corresponde
 * matrícula, ofrece bonificarla.
 */
const DetalleCobro = ({ presupuesto, calculando, error, bonificarMatricula, onBonificarMatricula }) => {
  if (error) return <p className="text-sm text-rose-700 font-medium">{error}</p>;
  if (!presupuesto) {
    return calculando
      ? <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Calculando el total...</p>
      : null;
  }
  const p = presupuesto;
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-sm transition-opacity ${calculando ? 'opacity-60' : ''}`}>
      <Fila texto={p.plan}>{formatMoneda(p.precioLista)}</Fila>
      {p.descuentoNombre && (
        <Fila texto={`Descuento: ${p.descuentoNombre}`}>
          <span className="text-emerald-700">− {formatMoneda(p.descuentoMonto)}</span>
        </Fila>
      )}
      {p.matriculaCorresponde && (
        <div>
          <Fila texto={`Matrícula (${p.matriculaMotivo})`}>
            {p.matriculaBonificada
              ? <><span className="line-through text-slate-500 font-normal mr-2">{formatMoneda(p.matriculaMonto)}</span>Bonificada</>
              : formatMoneda(p.matriculaMonto)}
          </Fila>
          <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={bonificarMatricula} onChange={e => onBonificarMatricula(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600" />
            Bonificar la matrícula (no cobrarla)
          </label>
        </div>
      )}
      <div className="flex justify-between items-baseline gap-3 pt-2 border-t border-slate-200">
        <span className="font-bold text-slate-800">Total a cobrar</span>
        <span className="text-xl font-bold text-slate-900">{formatMoneda(p.total)}</span>
      </div>
    </div>
  );
};

export default DetalleCobro;
