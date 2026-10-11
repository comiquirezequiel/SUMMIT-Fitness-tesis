import React, { useState, useRef, useEffect } from 'react';
import { ScanLine, ShieldCheck, XCircle, AlertTriangle, CalendarDays, Wallet, HeartPulse, UserX, DoorOpen } from 'lucide-react';
import { apiFetch } from '../services/api';
import { formatFecha, textoVencimiento } from '../utils/formato';

// Tarjeta chica con un dato de la ficha (días de la semana, cuota, apto)
const DatoFicha = ({ icon: Icon, titulo, valor, detalle, alerta }) => (
  <div className={`rounded-xl border p-3 ${alerta ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" /> {titulo}
    </p>
    <p className={`text-lg font-bold mt-1 ${alerta ? 'text-rose-700' : 'text-slate-800'}`}>{valor}</p>
    {detalle && <p className={`text-xs mt-0.5 ${alerta ? 'text-rose-600' : 'text-slate-500'}`}>{detalle}</p>}
  </div>
);

const datoSemana = (r) => {
  if (!r.plan) return { valor: '—', detalle: 'Sin plan' };
  if (r.diasSemanaPermitidos == null) {
    return { valor: 'Pase libre', detalle: `${r.diasSemanaUsados ?? 0} ${r.diasSemanaUsados === 1 ? 'día' : 'días'} esta semana` };
  }
  return {
    valor: `${r.diasSemanaUsados} de ${r.diasSemanaPermitidos}`,
    detalle: `Le ${r.diasSemanaRestantes === 1 ? 'queda' : 'quedan'} ${r.diasSemanaRestantes} esta semana`,
    alerta: r.resultado === 'DENEGADO_LIMITE_SEMANAL',
  };
};

/**
 * Control de acceso de recepción: el recepcionista escanea o escribe el DNI y ve la notificación
 * con el nombre del socio, las faltas que bloquean el ingreso, los avisos y los días que le quedan.
 */
const ControlAcceso = ({ onIngreso }) => {
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null); // respuesta del backend
  const [error, setError] = useState('');
  const [excepcion, setExcepcion] = useState(null); // { motivo, enviando, error } mientras se autoriza una excepción
  const inputRef = useRef(null);

  // Dejar pasar por excepción (cuota vencida o sin días del plan): queda registrado quién y por qué
  const confirmarExcepcion = async () => {
    setExcepcion(x => ({ ...x, enviando: true, error: '' }));
    try {
      const response = await apiFetch('/asistencia/molinete/excepcion', {
        method: 'POST',
        body: JSON.stringify({ dni: resultado.dni, motivo: excepcion.motivo }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo registrar la excepción');
      setResultado(data);
      setExcepcion(null);
      onIngreso?.();
    } catch (err) {
      setExcepcion(x => ({ ...x, enviando: false, error: err.message }));
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dniLimpio = dni.trim();
    if (!dniLimpio) return;

    setLoading(true);
    setError('');
    setExcepcion(null);
    try {
      const response = await apiFetch('/asistencia/molinete/verificar', {
        method: 'POST',
        body: JSON.stringify({ dni: dniLimpio }),
      });
      const data = await response.json().catch(() => ({}));

      // 200 = permitido, 403 con ficha = denegado; cualquier otra cosa es un error
      if (data && typeof data.permitido === 'boolean') {
        setResultado(data);
        onIngreso?.();
      } else {
        setResultado(null);
        setError(data.error || (response.status === 403
          ? 'Tu usuario no tiene permiso para registrar ingresos.'
          : 'No se pudo verificar el ingreso.'));
      }
    } catch {
      setResultado(null);
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
      setDni('');
      inputRef.current?.focus();
    }
  };

  const semana = resultado ? datoSemana(resultado) : null;
  const cuotaVencida = resultado?.diasParaVencerCuota != null && resultado.diasParaVencerCuota < 0;
  const aptoVencido = resultado?.diasParaVencerApto != null && resultado.diasParaVencerApto < 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div>
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-blue-600" /> Control de acceso
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Escaneá o escribí el DNI del socio y presioná Enter</p>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2 w-full md:w-auto">
          <input
            id="control-acceso-dni"
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            placeholder="DNI del socio"
            className="flex-1 md:w-64 text-lg font-bold tracking-widest px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal"
            autoComplete="off"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !dni.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-slate-50 flex items-center gap-3 text-slate-700">
          <UserX className="w-6 h-6 text-slate-400 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {!error && !resultado && (
        <div className="p-6 text-center text-slate-400 text-sm">
          Esperando el próximo ingreso...
        </div>
      )}

      {resultado && (
        <div className={`p-4 md:p-5 ${resultado.permitido ? 'bg-emerald-50/60' : 'bg-rose-50/60'}`}>
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${resultado.permitido ? 'bg-emerald-500' : 'bg-rose-500'}`}>
              {resultado.permitido
                ? <ShieldCheck className="w-8 h-8 text-white" />
                : <XCircle className="w-8 h-8 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-black uppercase tracking-widest ${resultado.permitido ? 'text-emerald-600' : 'text-rose-600'}`}>
                {resultado.permitido ? 'Acceso permitido' : 'Acceso denegado'}
              </p>
              <h3 className="text-2xl md:text-3xl font-extrabold text-slate-800 leading-tight truncate">{resultado.nombreSocio}</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                DNI {resultado.dni}
                {resultado.rol !== 'SOCIO' ? ` · Personal (${resultado.rol})` : ` · ${resultado.plan || 'Sin plan'}`}
                {' · '}{resultado.fechaHora?.substring(11, 16)} hs
              </p>
            </div>
          </div>

          {resultado.faltas?.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {resultado.faltas.map((falta, i) => (
                <li key={i} className="flex items-start gap-2 bg-rose-100 text-rose-800 rounded-lg px-3 py-2 text-sm font-semibold">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> {falta}
                </li>
              ))}
            </ul>
          )}

          {!resultado.permitido && resultado.excepcionPosible && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
              {excepcion === null ? (
                <button type="button" onClick={() => setExcepcion({ motivo: '', enviando: false, error: '' })}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors">
                  <DoorOpen className="w-4 h-4" /> Dejar pasar igual (excepción)
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-800">¿Por qué lo dejás pasar?</p>
                  <input autoFocus value={excepcion.motivo} maxLength={200}
                    onChange={e => setExcepcion({ ...excepcion, motivo: e.target.value })}
                    placeholder="Ej.: pagó por transferencia y se acredita mañana"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-100" />
                  <p className="text-xs text-slate-500">Queda registrado con tu nombre. Con el apto médico vencido no se puede.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={confirmarExcepcion} disabled={excepcion.enviando || excepcion.motivo.trim().length < 5}
                      className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50">
                      {excepcion.enviando ? 'Registrando...' : 'Confirmar ingreso'}
                    </button>
                    <button type="button" onClick={() => setExcepcion(null)}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
                      Cancelar
                    </button>
                  </div>
                  {excepcion.error && <p className="text-xs text-rose-600 font-medium">{excepcion.error}</p>}
                </div>
              )}
            </div>
          )}

          {resultado.permitido && resultado.mensaje?.startsWith('Ingreso por excepción') && (
            <p className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm font-semibold">
              <DoorOpen className="w-4 h-4 mt-0.5 shrink-0" /> {resultado.mensaje}
            </p>
          )}

          {resultado.avisos?.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {resultado.avisos.map((aviso, i) => (
                <li key={i} className="flex items-start gap-2 bg-amber-100 text-amber-800 rounded-lg px-3 py-2 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {aviso}
                </li>
              ))}
            </ul>
          )}

          {resultado.rol === 'SOCIO' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <DatoFicha icon={CalendarDays} titulo="Días esta semana" {...semana} />
              <DatoFicha
                icon={Wallet}
                titulo="Cuota"
                valor={resultado.vencimientoCuota ? formatFecha(resultado.vencimientoCuota) : 'Sin membresía'}
                detalle={textoVencimiento(resultado.diasParaVencerCuota)}
                alerta={!resultado.vencimientoCuota || resultado.resultado === 'DENEGADO_CUOTA_VENCIDA' || cuotaVencida}
              />
              <DatoFicha
                icon={HeartPulse}
                titulo="Apto médico"
                valor={resultado.vencimientoApto ? formatFecha(resultado.vencimientoApto) : 'Sin certificado'}
                detalle={textoVencimiento(resultado.diasParaVencerApto)}
                alerta={!resultado.vencimientoApto || resultado.resultado === 'DENEGADO_CERTIFICADO_MEDICO' || aptoVencido}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ControlAcceso;
