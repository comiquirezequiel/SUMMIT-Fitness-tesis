import { useCallback, useEffect, useState } from 'react';
import { Snowflake } from 'lucide-react';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import {
  congelarMembresia, listarCongelamientos, obtenerReglas, terminarCongelamiento, textoMotivoCongelamiento,
  MOTIVOS_CONGELAMIENTO,
} from '../../services/membresias';
import { formatFecha, hoyIso, diasHasta } from '../../utils/formato';

// Días entre dos fechas 'YYYY-MM-DD', las dos incluidas
const diasEntre = (desde, hasta) => (desde && hasta ? diasHasta(hasta) - diasHasta(desde) + 1 : 0);
const textoDias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

/**
 * Congelamiento de la membresía desde la ficha del socio: el que está en curso o programado (con su botón para
 * terminarlo o anularlo), el formulario para congelar y los anteriores. Mientras está congelada, el socio no puede
 * ingresar y el vencimiento se corre esos días.
 */
const CongelamientoSocio = ({ socio, onCambio }) => {
  const [congelamientos, setCongelamientos] = useState([]);
  const [reglas, setReglas] = useState(null);
  const [form, setForm] = useState(null); // null = formulario cerrado
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'aviso' | 'error', texto }

  const cargar = useCallback(() => {
    listarCongelamientos(socio.idSocio).then(setCongelamientos).catch(() => setCongelamientos([]));
  }, [socio.idSocio]);

  useEffect(() => {
    cargar();
    obtenerReglas().then(setReglas).catch(() => setReglas(null));
  }, [cargar]);

  const vigentes = congelamientos.filter(c => c.estado === 'EN_CURSO' || c.estado === 'PROGRAMADO');
  const anteriores = congelamientos.filter(c => c.estado === 'TERMINADO' || c.estado === 'ANULADO');
  const gimnasioCongela = !reglas || reglas.congelamientoMaxDiasAnio > 0;
  const dias = form ? diasEntre(form.desde, form.hasta) : 0;

  const abrir = () => {
    setMensaje(null);
    setForm({ desde: hoyIso(), hasta: '', motivo: 'VACACIONES', observacion: '' });
  };
  const cambiar = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }));

  const congelar = async (e) => {
    e.preventDefault();
    setProcesando(true);
    setMensaje(null);
    try {
      const r = await congelarMembresia(socio.idSocio, { ...form, observacion: form.observacion.trim() || null });
      setForm(null);
      setMensaje({
        tipo: r.aviso ? 'aviso' : 'ok',
        texto: `Membresía congelada del ${formatFecha(r.desde)} al ${formatFecha(r.hasta)}: ahora vence el `
          + `${formatFecha(r.vencimientoMembresia)}.${r.aviso ? ` ${r.aviso}.` : ''}`,
      });
      cargar();
      onCambio?.();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setProcesando(false);
    }
  };

  const terminar = async (c) => {
    const pregunta = c.estado === 'PROGRAMADO'
      ? `¿Anular el congelamiento del ${formatFecha(c.desde)} al ${formatFecha(c.hasta)}? Se le descuentan los ${c.dias} días que se le habían sumado al vencimiento.`
      : '¿Terminar el congelamiento hoy? Se le descuentan del vencimiento los días que no usó y ya puede ingresar.';
    if (!window.confirm(pregunta)) return;
    setProcesando(true);
    setMensaje(null);
    try {
      const r = await terminarCongelamiento(socio.idSocio, c.idCongelamiento);
      setMensaje({
        tipo: 'ok',
        texto: r.estado === 'ANULADO'
          ? `Congelamiento anulado: la membresía vence el ${formatFecha(r.vencimientoMembresia)}.`
          : `Congelamiento terminado (usó ${textoDias(r.dias)}): la membresía vence el ${formatFecha(r.vencimientoMembresia)}.`,
      });
      cargar();
      onCambio?.();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="space-y-3">
      {vigentes.map(c => (
        <div key={c.idCongelamiento} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-cyan-200 bg-cyan-50">
          <div className="text-sm min-w-0">
            <p className="font-semibold text-cyan-900 flex items-center gap-2">
              <Snowflake className="w-4 h-4 shrink-0" />
              {c.estado === 'EN_CURSO'
                ? `Congelada hasta el ${formatFecha(c.hasta)}`
                : `Congelamiento programado del ${formatFecha(c.desde)} al ${formatFecha(c.hasta)}`}
            </p>
            <p className="text-xs text-cyan-800 mt-0.5">
              {textoMotivoCongelamiento(c.motivo)} · {textoDias(c.dias)}{c.observacion ? ` · ${c.observacion}` : ''}
              {c.registradoPor ? ` · lo cargó ${c.registradoPor}` : ''}
            </p>
          </div>
          <button type="button" onClick={() => terminar(c)} disabled={procesando}
            className="px-3 py-1.5 text-xs font-semibold text-cyan-800 border border-cyan-300 hover:bg-cyan-100 rounded-lg">
            {c.estado === 'EN_CURSO' ? 'Volvió: terminar hoy' : 'Anular'}
          </button>
        </div>
      ))}

      {form ? (
        <form onSubmit={congelar} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Campo label="Desde" required>
              <input type="date" required min={hoyIso()} value={form.desde} onChange={e => cambiar('desde', e.target.value)} className={inputClass} />
            </Campo>
            <Campo label="Hasta (incluido)" required>
              <input type="date" required min={form.desde || hoyIso()} value={form.hasta} onChange={e => cambiar('hasta', e.target.value)} className={inputClass} />
            </Campo>
            <Campo label="Motivo" required>
              <select value={form.motivo} onChange={e => cambiar('motivo', e.target.value)} className={inputClass}>
                {MOTIVOS_CONGELAMIENTO.map(m => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Observación">
            <input type="text" maxLength={200} value={form.observacion} placeholder="Opcional (ej. trajo certificado de la lesión)"
              onChange={e => cambiar('observacion', e.target.value)} className={inputClass} />
          </Campo>
          <p className="text-xs text-slate-500">
            {dias > 0
              ? `${textoDias(dias)}: el vencimiento se corre ${textoDias(dias)} y mientras tanto no puede ingresar. `
              : 'Elegí hasta qué día. '}
            {reglas && `Mínimo ${textoDias(reglas.congelamientoMinDias)}; hasta ${textoDias(reglas.congelamientoMaxDiasAnio)} por año.`}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className={botonSecundario}>Cancelar</button>
            <button type="submit" disabled={procesando || dias <= 0} className={botonPrimario}>
              <Snowflake className="w-4 h-4" /> {procesando ? 'Guardando...' : 'Congelar'}
            </button>
          </div>
        </form>
      ) : (
        gimnasioCongela && socio.estado === 'ACTIVO' && socio.vencimientoMembresia && (
          <button type="button" onClick={abrir} className="text-sm font-semibold text-cyan-700 hover:text-cyan-800 flex items-center gap-1.5">
            <Snowflake className="w-4 h-4" /> Congelar membresía
          </button>
        )
      )}

      {mensaje && (
        <p className={`text-sm font-medium ${mensaje.tipo === 'ok' ? 'text-emerald-700' : mensaje.tipo === 'aviso' ? 'text-amber-700' : 'text-rose-600'}`}>
          {mensaje.texto}
        </p>
      )}

      {anteriores.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500">Congelamientos anteriores ({anteriores.length})</summary>
          <ul className="mt-2 space-y-1">
            {anteriores.map(c => (
              <li key={c.idCongelamiento} className="flex justify-between gap-3 text-xs">
                <span className={c.estado === 'ANULADO' ? 'text-slate-400 line-through' : 'text-slate-600'}>
                  {formatFecha(c.desde)} al {formatFecha(c.hasta)} · {textoMotivoCongelamiento(c.motivo)}
                </span>
                <span className="text-slate-500 whitespace-nowrap">
                  {c.estado === 'ANULADO' ? 'Anulado' : `${textoDias(c.dias)}${c.terminadoAntes ? ' (volvió antes)' : ''}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

export default CongelamientoSocio;
