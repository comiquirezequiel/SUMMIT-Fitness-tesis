import { useState } from 'react';
import { Save, Ban, History, ScanLine } from 'lucide-react';
import Modal from '../Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import { apiFetch } from '../../services/api';
import { formatFechaHora, hoyIso } from '../../utils/formato';
import { duracion, hora, horaSalida, sumarDias, textoRol, diaCorto, ACCIONES_CORRECCION } from './comun';

// "Entrada 07:58 → 07:30": lo que cambió en una corrección (comparado al minuto, que es lo que se ve)
const cambios = (c) => {
  const lista = [];
  const minuto = (v) => (v ? v.substring(0, 16) : null);
  if (minuto(c.entradaAnterior) !== minuto(c.entradaNueva)) {
    lista.push(`Entrada ${c.entradaAnterior ? hora(c.entradaAnterior) : '—'} → ${c.entradaNueva ? hora(c.entradaNueva) : '—'}`);
  }
  if (minuto(c.salidaAnterior) !== minuto(c.salidaNueva)) {
    const antes = c.salidaAnterior ? horaSalida(c.entradaAnterior, c.salidaAnterior) : 'sin salida';
    const despues = c.salidaNueva ? horaSalida(c.entradaNueva, c.salidaNueva) : 'sin salida';
    lista.push(`Salida ${antes} → ${despues}`);
  }
  return lista.join(' · ');
};

/** Quién cargó o corrigió el turno, cuándo y por qué. */
export const HistorialTurno = ({ turno }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
      <History className="w-3.5 h-3.5" /> Historial
    </p>
    {turno.origen === 'RECEPCION' && (
      <p className="text-xs text-slate-600 flex items-center gap-1.5">
        <ScanLine className="w-3.5 h-3.5 text-slate-400" /> Registrado en recepción con el control de acceso
      </p>
    )}
    {turno.correcciones.length === 0 && turno.origen === 'RECEPCION' && (
      <p className="text-xs text-slate-500">Sin correcciones.</p>
    )}
    {turno.correcciones.map((c, i) => (
      <div key={i} className="text-xs text-slate-600 border-t border-slate-200 pt-2 first:border-0 first:pt-0">
        <p>
          <span className="font-semibold text-slate-800">{ACCIONES_CORRECCION[c.accion] || c.accion}</span> por {c.autor} el {formatFechaHora(c.fecha)}
        </p>
        <p className="italic">“{c.motivo}”</p>
        {c.accion === 'CAMBIO' && cambios(c) && <p className="text-slate-500">{cambios(c)}</p>}
        {c.accion === 'ALTA' && (
          <p className="text-slate-500">
            Entrada {hora(c.entradaNueva)} · Salida {c.salidaNueva ? horaSalida(c.entradaNueva, c.salidaNueva) : 'sin salida'}
          </p>
        )}
      </div>
    ))}
  </div>
);

/**
 * Cargar un turno olvidado (turno = null) o corregir uno: día, hora de entrada y de salida, y el motivo, que queda
 * registrado con el nombre de quien lo hace. Una salida más temprana que la entrada es del día siguiente (pasó la
 * medianoche). También permite anular el turno.
 */
const TurnoModal = ({ turno, equipo = [], inicial = {}, onClose, onGuardado }) => {
  const nuevo = !turno;
  const [idUsuario, setIdUsuario] = useState(String(inicial.idUsuario || ''));
  const [dia, setDia] = useState(turno ? turno.entrada.substring(0, 10) : inicial.dia || '');
  const [entrada, setEntrada] = useState(turno ? hora(turno.entrada) : '');
  const [salida, setSalida] = useState(turno?.salida ? hora(turno.salida) : '');
  const [motivo, setMotivo] = useState('');
  const [anulando, setAnulando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const salidaAlDiaSiguiente = !!(salida && entrada && salida < entrada);
  const enMinutos = (h) => Number(h.substring(0, 2)) * 60 + Number(h.substring(3, 5));
  const minutos = entrada && salida ? enMinutos(salida) - enMinutos(entrada) + (salidaAlDiaSiguiente ? 24 * 60 : 0) : null;
  const activos = equipo.filter(m => m.activo || String(m.idUsuario) === idUsuario);

  const enviar = async (ruta, metodo, cuerpo, mensaje) => {
    setEnviando(true);
    setError('');
    try {
      const res = await apiFetch(ruta, { method: metodo, body: JSON.stringify(cuerpo) });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.error || 'No se pudo guardar');
      onGuardado(mensaje(datos));
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  const guardar = (e) => {
    e.preventDefault();
    const cuerpo = {
      idUsuario: nuevo ? Number(idUsuario) : undefined,
      entrada: `${dia}T${entrada}`,
      salida: salida ? `${salidaAlDiaSiguiente ? sumarDias(dia, 1) : dia}T${salida}` : null,
      motivo: motivo.trim(),
    };
    if (nuevo) {
      enviar('/asistencia/personal/turnos', 'POST', cuerpo, (t) => `Turno de ${t.nombre} cargado (${diaCorto(t.entrada)}).`);
    } else {
      enviar(`/asistencia/personal/turnos/${turno.idTurno}`, 'PUT', cuerpo, (t) => `Turno de ${t.nombre} corregido (${diaCorto(t.entrada)}).`);
    }
  };

  const anular = () => enviar(`/asistencia/personal/turnos/${turno.idTurno}/anular`, 'POST', { motivo: motivo.trim() },
    (t) => `Turno de ${t.nombre} anulado (${diaCorto(t.entrada)}): ya no suma horas.`);

  const motivoValido = motivo.trim().length >= 5;
  const subtitulo = nuevo
    ? 'Para quien se olvidó de pasar el DNI al llegar'
    : `${turno.nombre} · ${textoRol(turno.rol)} · ${diaCorto(turno.entrada)}`;

  if (turno?.anulado) {
    return (
      <Modal titulo="Turno anulado" subtitulo={subtitulo} onClose={onClose}
        pie={<button type="button" onClick={onClose} className={botonSecundario}>Cerrar</button>}>
        <p className="text-sm text-slate-600 mb-2">
          Entrada {hora(turno.entrada)} · Salida {turno.salida ? horaSalida(turno.entrada, turno.salida) : 'sin salida'}. No suma horas.
        </p>
        <HistorialTurno turno={turno} />
      </Modal>
    );
  }

  return (
    <Modal titulo={nuevo ? 'Cargar turno' : 'Corregir turno'} subtitulo={subtitulo} onClose={onClose} ancho="max-w-xl"
      pie={anulando ? (
        <>
          <button type="button" onClick={() => setAnulando(false)} className={botonSecundario}>Volver</button>
          <button type="button" onClick={anular} disabled={enviando || !motivoValido}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 rounded-lg flex items-center gap-2">
            <Ban className="w-4 h-4" /> {enviando ? 'Anulando...' : 'Confirmar anulación'}
          </button>
        </>
      ) : (
        <>
          {!nuevo && (
            <button type="button" onClick={() => { setAnulando(true); setError(''); }}
              className="mr-auto px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-2">
              <Ban className="w-4 h-4" /> Anular turno
            </button>
          )}
          <button type="button" onClick={onClose} className={botonSecundario}>Cancelar</button>
          <button type="submit" form="form-turno" disabled={enviando || !motivoValido} className={botonPrimario}>
            <Save className="w-4 h-4" /> {enviando ? 'Guardando...' : nuevo ? 'Cargar turno' : 'Guardar corrección'}
          </button>
        </>
      )}>
      <form id="form-turno" onSubmit={guardar} className="space-y-3">
        {anulando ? (
          <p className="text-sm text-slate-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
            El turno deja de sumar horas, pero queda guardado con el motivo y tu nombre.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {nuevo && (
              <Campo label="Persona" required className="col-span-2 sm:col-span-4">
                <select required value={idUsuario} onChange={e => setIdUsuario(e.target.value)} className={inputClass}>
                  <option value="">Elegí quién trabajó</option>
                  {activos.map(m => (
                    <option key={m.idUsuario} value={m.idUsuario}>{m.nombre} ({textoRol(m.rol)}){m.activo ? '' : ' · inactivo'}</option>
                  ))}
                </select>
              </Campo>
            )}
            <Campo label="Día" required className="col-span-2">
              <input type="date" required value={dia} max={hoyIso()}
                onChange={e => setDia(e.target.value)} className={inputClass} />
            </Campo>
            <Campo label="Entrada" required>
              <input type="time" required value={entrada} onChange={e => setEntrada(e.target.value)} className={inputClass} />
            </Campo>
            <Campo label="Salida">
              <input type="time" value={salida} onChange={e => setSalida(e.target.value)} className={inputClass} />
            </Campo>
            <p className="col-span-2 sm:col-span-4 text-xs text-slate-500 -mt-1">
              {minutos != null && minutos > 0
                ? <>Turno de <b>{duracion(minutos)}</b>{salidaAlDiaSiguiente && <> · la salida es del día siguiente (pasó la medianoche)</>}.</>
                : salida
                  ? 'Revisá las horas.'
                  : 'Sin salida solo si la persona sigue trabajando ahora.'}
            </p>
          </div>
        )}
        <Campo label={anulando ? '¿Por qué lo anulás?' : 'Motivo'} required
          ayuda="Queda registrado con tu nombre, la fecha y la hora.">
          <input value={motivo} maxLength={200} onChange={e => setMotivo(e.target.value)} className={inputClass}
            placeholder={anulando ? 'Ej.: pasó el DNI por error, no trabajó' : 'Ej.: se olvidó de pasar el DNI a la salida'} />
        </Campo>
        {error && <p className="text-sm text-rose-700 font-medium">{error}</p>}
        {!nuevo && <HistorialTurno turno={turno} />}
      </form>
    </Modal>
  );
};

export default TurnoModal;
