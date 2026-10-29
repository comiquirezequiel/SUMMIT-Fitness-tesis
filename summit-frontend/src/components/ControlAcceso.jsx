import { useState, useRef, useEffect } from 'react';
import { ScanLine, ShieldCheck, XCircle, UserX, DoorOpen, Camera, Snowflake, Wallet, CheckCircle2 } from 'lucide-react';
import FotoSocio from './socios/FotoSocio';
import CapturaFoto from './socios/CapturaFoto';
import CobroRapido from './socios/CobroRapido';
import { formatMoneda } from '../utils/formato';
import { FaltasIngreso, AvisosIngreso, DatosFicha } from './FichaIngreso';
import FichaPersonal from './asistencia/FichaPersonal';
import { apiFetch } from '../services/api';
import { subirFotoSocio } from '../services/fotos';
import { terminarCongelamiento, DIAS_PARA_OFRECER_COBRO } from '../services/membresias';

// Socio sin membresía, con la cuota vencida (aunque esté en los días de gracia) o por vencer: se le puede cobrar ahí
const cuotaParaCobrar = (r) => r.rol === 'SOCIO' && !r.idCongelamiento
  && (!r.vencimientoCuota || r.resultado === 'DENEGADO_CUOTA_VENCIDA' || r.diasParaVencerCuota <= DIAS_PARA_OFRECER_COBRO);

/**
 * Control de acceso de recepción: el recepcionista escanea o escribe el DNI y ve la notificación
 * con el nombre del socio, las faltas que bloquean el ingreso, los avisos y los días que le quedan.
 * Si la cuota está vencida o por vencer, se la puede cobrar desde la misma ficha.
 * Si el DNI es de alguien del equipo, su paso es su entrada o su salida (Asistencia del personal).
 */
const ControlAcceso = ({ onIngreso }) => {
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null); // respuesta del backend
  const [error, setError] = useState('');
  const [excepcion, setExcepcion] = useState(null); // { motivo, enviando, error } mientras se autoriza una excepción
  const [terminando, setTerminando] = useState(null); // { enviando, error } mientras se termina un congelamiento
  const [cobrando, setCobrando] = useState(false);
  const [cobrado, setCobrado] = useState(null); // el cobro recién registrado desde la ficha
  const [sacandoFoto, setSacandoFoto] = useState(false);
  const [invirtiendo, setInvirtiendo] = useState({ enviando: false, error: '' }); // "Es una entrada / una salida"
  const inputRef = useRef(null);

  // Personal: el sistema tomó su paso al revés (por ejemplo, se había olvidado de marcar la salida). Queda registrado
  const invertirFichada = async () => {
    setInvirtiendo({ enviando: true, error: '' });
    try {
      const response = await apiFetch('/asistencia/molinete/invertir-fichada', {
        method: 'POST',
        body: JSON.stringify({ idTurno: resultado.idTurno, fichada: resultado.fichada }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo corregir');
      setResultado(data);
      setInvirtiendo({ enviando: false, error: '' });
      onIngreso?.();
    } catch (err) {
      setInvirtiendo({ enviando: false, error: err.message });
    } finally {
      inputRef.current?.focus();
    }
  };

  // Socio sin foto: se la saca ahí mismo, mientras está en recepción
  const guardarFoto = async (foto) => {
    const r = await subirFotoSocio(resultado.idUsuario, foto);
    if (r.ok) {
      setResultado(actual => ({ ...actual, fotoVersion: r.fotoVersion }));
      setSacandoFoto(false);
      inputRef.current?.focus();
      onIngreso?.(); // el tablero recarga la actividad: la fila del socio ya muestra la foto
    }
    return r;
  };

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

  // Volvió antes con la membresía congelada: se termina el congelamiento y se verifica de nuevo
  const terminarYVerificar = async () => {
    if (!window.confirm(`¿Terminar el congelamiento de ${resultado.nombreSocio}? Se le descuentan del vencimiento los días que no usó.`)) return;
    setTerminando({ enviando: true, error: '' });
    try {
      await terminarCongelamiento(resultado.idUsuario, resultado.idCongelamiento);
      await verificar(resultado.dni);
    } catch (err) {
      setTerminando({ enviando: false, error: err.message });
    }
  };

  // Cobró desde la ficha: si no lo dejaba pasar, se verifica de nuevo (con la cuota al día, ahora puede entrar)
  const alCobrar = async (pago) => {
    setCobrando(false);
    if (!resultado.permitido) await verificar(resultado.dni);
    setCobrado(pago);
    onIngreso?.();
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const dniLimpio = dni.trim();
    if (dniLimpio) verificar(dniLimpio);
  };

  const verificar = async (dniLimpio) => {
    setLoading(true);
    setError('');
    setExcepcion(null);
    setTerminando(null);
    setCobrado(null);
    setInvirtiendo({ enviando: false, error: '' });
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

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div>
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-blue-600" /> Control de acceso
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Escaneá o escribí el DNI y presioná Enter. El equipo marca así su entrada y su salida</p>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2 w-full md:w-auto">
          <input
            id="control-acceso-dni"
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            placeholder="DNI"
            className="flex-1 md:w-64 text-lg font-bold tracking-widest px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal"
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

      {resultado?.fichada && (
        <FichaPersonal ficha={resultado} onInvertir={invertirFichada} invirtiendo={invirtiendo} />
      )}

      {resultado && !resultado.fichada && (
        <div className={`p-4 md:p-5 ${resultado.permitido ? 'bg-emerald-50/60' : 'bg-rose-50/60'}`}>
          <div className="flex items-start gap-4">
            {resultado.fotoVersion ? (
              // Con foto: recepción compara la cara con la persona que tiene adelante
              <div className="relative shrink-0">
                <FotoSocio idSocio={resultado.idUsuario} fotoVersion={resultado.fotoVersion} nombre={resultado.nombreSocio}
                  className="w-24 h-24 md:w-28 md:h-28 rounded-2xl" texto="text-2xl" />
                <span className={`absolute -bottom-2 -right-2 w-9 h-9 rounded-full ring-4 ring-white flex items-center justify-center ${resultado.permitido ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                  {resultado.permitido ? <ShieldCheck className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
                </span>
              </div>
            ) : (
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${resultado.permitido ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                {resultado.permitido
                  ? <ShieldCheck className="w-8 h-8 text-white" />
                  : <XCircle className="w-8 h-8 text-white" />}
              </div>
            )}
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
              {resultado.rol === 'SOCIO' && !resultado.fotoVersion && (
                <button type="button" onClick={() => setSacandoFoto(true)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-600 text-xs font-semibold hover:bg-blue-50">
                  <Camera className="w-3.5 h-3.5" /> No tiene foto: sacarla ahora
                </button>
              )}
            </div>
          </div>
          {sacandoFoto && (
            <CapturaFoto nombre={resultado.nombreSocio} onListo={guardarFoto}
              onCerrar={() => { setSacandoFoto(false); inputRef.current?.focus(); }} />
          )}

          <FaltasIngreso faltas={resultado.faltas} />

          {cobrado && (
            <p className="mt-3 flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> Cobro de {formatMoneda(cobrado.monto)} registrado ({cobrado.plan}).
            </p>
          )}

          {!cobrado && cuotaParaCobrar(resultado) && (
            <button type="button" onClick={() => setCobrando(true)}
              className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors">
              <Wallet className="w-4 h-4" /> {resultado.vencimientoCuota ? 'Cobrar la cuota' : 'Cobrar un plan'}
            </button>
          )}
          {cobrando && (
            <CobroRapido idSocio={resultado.idUsuario} onClose={() => setCobrando(false)} onCobrado={alCobrar} />
          )}

          {!resultado.permitido && resultado.idCongelamiento && (
            <div className="mt-3 rounded-xl border border-cyan-200 bg-white p-3 space-y-2">
              <button type="button" onClick={terminarYVerificar} disabled={terminando?.enviando}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
                <Snowflake className="w-4 h-4" /> {terminando?.enviando ? 'Terminando...' : 'Volvió antes: terminar el congelamiento'}
              </button>
              <p className="text-xs text-slate-500">Se le descuentan del vencimiento los días que no usó y se vuelve a verificar el ingreso.</p>
              {terminando?.error && <p className="text-xs text-rose-600 font-medium">{terminando.error}</p>}
            </div>
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-100" />
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

          <AvisosIngreso avisos={resultado.avisos} />

          {resultado.rol === 'SOCIO' && <DatosFicha ficha={resultado} />}
        </div>
      )}
    </div>
  );
};

export default ControlAcceso;
