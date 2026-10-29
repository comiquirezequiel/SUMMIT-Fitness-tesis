import { Clock, Weight, Repeat } from 'lucide-react';
import { agruparPorDia, formatDescanso, formatKg, nombreGrupo, seriesPorReps } from './comun';

/**
 * Detalle de una rutina por días (lectura): ejercicios en orden con series, repeticiones,
 * peso sugerido, descanso y observaciones.
 */
const DetalleRutina = ({ rutina }) => {
  const dias = agruparPorDia(rutina.ejercicios);
  if (dias.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-6">La rutina todavía no tiene ejercicios.</p>;
  }
  return (
    <div className="space-y-5">
      {dias.map(([dia, ejercicios]) => (
        <section key={dia}>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
            Día {dia} <span className="font-medium normal-case tracking-normal">· {ejercicios.length} {ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
          </h4>
          <ol className="space-y-2">
            {ejercicios.map((e, i) => (
              <li key={e.idRutinaEjercicio} className="flex gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                <span className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 leading-tight">{e.nombreEjercicio}</p>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{nombreGrupo(e.grupoMuscular)}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-600">
                    <span className="flex items-center gap-1"><Repeat className="w-3.5 h-3.5 text-slate-400" />{seriesPorReps(e.series, e.repeticiones)}</span>
                    <span className="flex items-center gap-1"><Weight className="w-3.5 h-3.5 text-slate-400" />{formatKg(e.pesoSugeridoKg)}</span>
                    {formatDescanso(e.descansoSegundos) && (
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" />{formatDescanso(e.descansoSegundos)} de descanso</span>
                    )}
                  </div>
                  {e.observaciones && <p className="text-xs text-slate-500 italic mt-1">{e.observaciones}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
};

export default DetalleRutina;
