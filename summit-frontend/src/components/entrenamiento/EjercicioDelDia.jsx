import React, { useState } from 'react';
import { CheckCircle2, Pencil, Trash2, History, Save, Loader2 } from 'lucide-react';
import { inputClass } from '../Campo';
import { formatFecha } from '../../utils/formato';
import {
  enviarJson, formatKg, formatDescanso, nombreGrupo, seriesPorReps, claseRpe,
} from './comun';

const RPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const aTexto = (v) => (v === null || v === undefined ? '' : String(v));

const validar = (f) => {
  if (!f.rpe) return 'Elegí el RPE (esfuerzo percibido) de 1 a 10.';
  if (f.pesoKg !== '' && !(Number(f.pesoKg) >= 0 && Number(f.pesoKg) <= 500)) return 'El peso debe ser de 0 a 500 kg.';
  if (!(Number.isInteger(Number(f.repeticiones)) && Number(f.repeticiones) >= 1 && Number(f.repeticiones) <= 100)) return 'Las repeticiones deben ser de 1 a 100.';
  if (!(Number.isInteger(Number(f.series)) && Number(f.series) >= 1 && Number(f.series) <= 20)) return 'Las series deben ser de 1 a 20.';
  if (f.comentario.length > 300) return 'El comentario no puede superar los 300 caracteres.';
  return '';
};

/**
 * Un ejercicio de la rutina del día: lo indicado por el profesor, lo de la vez pasada
 * y lo registrado hoy. El personal (ADMIN y PROFESOR) puede cargarlo en nombre del socio.
 * onCambio(aviso): se llama después de guardar o borrar, para recargar la rutina.
 */
const EjercicioDelDia = ({ ejercicio: e, numero, puedeCargar, onCambio }) => {
  const reg = e.registroHoy;
  const previo = e.ultimoRegistro;
  const [editando, setEditando] = useState(!reg);
  const [form, setForm] = useState({
    pesoKg: aTexto(reg ? reg.pesoKg : (previo?.pesoKg ?? e.pesoSugeridoKg)),
    repeticiones: aTexto(reg?.repeticiones ?? e.repeticiones),
    series: aTexto(reg?.series ?? e.series),
    rpe: reg?.rpe ?? null,
    comentario: reg?.comentario || '',
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (ev) => setForm((f) => ({ ...f, [campo]: ev.target.value }));

  const guardar = async (ev) => {
    ev.preventDefault();
    const problema = validar(form);
    if (problema) { setError(problema); return; }
    setGuardando(true);
    setError('');
    const r = await enviarJson('/entrenamientos', 'POST', {
      idRutinaEjercicio: e.idRutinaEjercicio,
      pesoKg: form.pesoKg === '' ? null : Number(form.pesoKg),
      repeticiones: Number(form.repeticiones),
      series: Number(form.series),
      rpe: form.rpe,
      comentario: form.comentario.trim() || null,
    });
    setGuardando(false);
    if (!r.ok) { setError(r.data?.error || 'No se pudo guardar el registro.'); return; }
    onCambio({ tipo: 'exito', texto: `${e.nombreEjercicio}: ${r.status === 201 ? 'registro guardado' : 'registro actualizado'}.` });
  };

  const borrar = async () => {
    if (!window.confirm(`¿Borrar el registro de hoy de "${e.nombreEjercicio}"?`)) return;
    setGuardando(true);
    const r = await enviarJson(`/entrenamientos/${reg.idLog}`, 'DELETE');
    setGuardando(false);
    if (!r.ok) { setError(r.data?.error || 'No se pudo borrar el registro.'); return; }
    onCambio({ tipo: 'exito', texto: `${e.nombreEjercicio}: registro borrado.` });
  };

  const descanso = formatDescanso(e.descansoSegundos);

  return (
    <li className={`rounded-xl border p-4 ${reg ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex gap-3">
        <span className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center shrink-0 border ${reg
          ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
          {reg ? <CheckCircle2 className="w-4 h-4" /> : numero}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="font-bold text-slate-800">{e.nombreEjercicio}</h3>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{nombreGrupo(e.grupoMuscular)}</span>
          </div>
          <p className="text-sm text-slate-600 mt-0.5">
            Indicado: <b className="text-slate-800">{seriesPorReps(e.series, e.repeticiones)}</b> · {formatKg(e.pesoSugeridoKg)}
            {descanso && ` · ${descanso} de descanso`}
          </p>
          {e.observaciones && <p className="text-xs text-slate-500 italic mt-0.5">{e.observaciones}</p>}
          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 shrink-0" />
            {previo
              ? <>La vez pasada ({formatFecha(previo.fecha)}): <b className="text-slate-700">{formatKg(previo.pesoKg)} · {seriesPorReps(previo.series, previo.repeticiones)} · RPE {previo.rpe}</b></>
              : 'Primera vez que registra este ejercicio.'}
          </p>
        </div>
      </div>

      {reg && !editando && (
        <div className="mt-3 sm:ml-11 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-white border border-emerald-200">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-emerald-700">Hoy:</span> {formatKg(reg.pesoKg)} · {seriesPorReps(reg.series, reg.repeticiones)} ·{' '}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${claseRpe(reg.rpe)}`}>RPE {reg.rpe}</span>
            {reg.comentario && <span className="text-slate-500 italic"> · “{reg.comentario}”</span>}
          </p>
          {puedeCargar && (
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setEditando(true)} className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
              <button onClick={borrar} disabled={guardando} className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center gap-1 disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> Borrar
              </button>
            </div>
          )}
        </div>
      )}

      {!reg && !puedeCargar && <p className="mt-3 sm:ml-11 text-xs text-slate-400">Sin registrar hoy.</p>}

      {editando && puedeCargar && (
        <form onSubmit={guardar} className="mt-3 sm:ml-11 space-y-3" noValidate>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1" htmlFor={`peso-${e.idRutinaEjercicio}`}>Peso (kg)</label>
              <input id={`peso-${e.idRutinaEjercicio}`} type="number" inputMode="decimal" min="0" max="500" step="0.5" value={form.pesoKg}
                onChange={cambiar('pesoKg')} placeholder="Corporal" className={inputClass} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1" htmlFor={`reps-${e.idRutinaEjercicio}`}>Reps</label>
              <input id={`reps-${e.idRutinaEjercicio}`} type="number" inputMode="numeric" min="1" max="100" value={form.repeticiones}
                onChange={cambiar('repeticiones')} className={inputClass} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1" htmlFor={`series-${e.idRutinaEjercicio}`}>Series</label>
              <input id={`series-${e.idRutinaEjercicio}`} type="number" inputMode="numeric" min="1" max="20" value={form.series}
                onChange={cambiar('series')} className={inputClass} />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1">RPE <span className="normal-case font-normal">(1 muy fácil · 10 al máximo)</span></p>
            <div className="flex flex-wrap gap-1" role="group" aria-label={`RPE de ${e.nombreEjercicio}`}>
              {RPES.map((n) => (
                <button key={n} type="button" onClick={() => setForm((f) => ({ ...f, rpe: n }))} aria-pressed={form.rpe === n}
                  className={`w-8 h-8 rounded-lg text-sm font-bold border transition-colors ${form.rpe === n
                    ? `${claseRpe(n)} ring-2 ring-offset-1 ring-blue-400` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="text" value={form.comentario} onChange={cambiar('comentario')} maxLength={300}
              placeholder="Comentario (opcional)" aria-label="Comentario" className={`${inputClass} flex-1`} />
            <div className="flex gap-2">
              {reg && (
                <button type="button" onClick={() => { setEditando(false); setError(''); }}
                  className="px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
              )}
              <button type="submit" disabled={guardando}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg flex items-center justify-center gap-1.5">
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {reg ? 'Guardar cambios' : 'Registrar'}
              </button>
            </div>
          </div>
        </form>
      )}
      {error && <p className="mt-2 sm:ml-11 text-sm text-rose-600" role="alert">{error}</p>}
    </li>
  );
};

export default EjercicioDelDia;
