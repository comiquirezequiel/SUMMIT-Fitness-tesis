import { useState, useRef, useEffect } from 'react';
import { ScanLine, ShieldCheck, XCircle, UserX, DoorOpen, Camera, Snowflake, Wallet, CheckCircle2, IdCard } from 'lucide-react';
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
 * Control de acceso de recepción: el recepcionista escanea o escribe el DNI y, abajo, en "Información rápida del
 * socio", ve la foto y el nombre, las faltas que bloquean el ingreso, los avisos, la cuota, los días de la semana y el
 * apto. Si la cuota está vencida o por vencer, se la puede cobrar desde la misma ficha.
 * Si el DNI es de alguien del equipo, su paso es su entrada o su salida (Gestión de personal > Asistencia).
 * acciones: los botones que van al lado del DNI, uno arriba del otro (en el tablero: Nuevo socio y Cobrar cuota).
 */
const ControlAcceso = ({ onIngreso, acciones }) => {
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

  // Vuelve a "esperando": la ficha del anterior no queda a la vista del que sigue
  const limpiar = () => {
    setResultado(null);
    setError('');
    setExcepcion(null);
    setTerminando(null);
    setCobrado(null);
    inputRef.current?.focus();
  };

  // Cobrar, terminar el congelamiento o dejar pasar: los botones van juntos en una fila
  const ofreceCobro = Boolean(resultado) && !cobrado && cuotaParaCobrar(resultado);
  const ofreceTerminar = Boolean(resultado) && !resultado.permitido && Boolean(resultado.idCongelamiento);
  const ofreceExcepcion = Boolean(resultado) && !resultado.permitido && Boolean(resultado.excepcionPosible);

  return (
    // @container: con lugar a lo ancho (38rem o más) la ficha pone al lado de la foto lo que le falta y los botones.
    // h-full: si el tablero lo estira (para que mida lo mismo que la actividad), lo de abajo ocupa el resto
    <section className="@container h-full flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden" aria-label="Control de acceso">
      <div className="p-3 flex flex-col sm:flex-row gap-3 border-b border-slate-100">
        <form onSubmit={handleSubmit} className="flex-1 min-w-0 flex flex-col justify-center">
          <label htmlFor="control-acceso-dni" className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1">
            <ScanLine className="w-4 h-4 text-blue-600" /> Ingreso por DNI
          </label>
          <div className="flex gap-2">
            <input
              id="control-acceso-dni"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Escaneá o escribí el DNI"
              className="flex-1 min-w-0 text-base font-bold tracking-widest px-3 py-1.5 tactil:py-2.5 bg-slate-50 border-2 border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal placeholder:text-sm"
              autoComplete="off"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !dni.trim()}
              className="px-3 py-1.5 tactil:min-h-11 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors shrink-0"
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">Enter para verificar. El equipo marca así su entrada y su salida.</p>
        </form>
        {/* Acciones de recepción al lado del DNI, una arriba de la otra (en el celular, una al lado de la otra) */}
        {acciones && (
          <div className="grid grid-cols-2 sm:grid-cols-1 gap-1.5 sm:w-40 shrink-0 content-center">
            {acciones}
          </div>
        )}
      </div>

      <div className="px-3 py-1.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
          <IdCard className="w-3.5 h-3.5" /> Información rápida del socio
        </h2>
        {(resultado || error) && (
          <button type="button" onClick={limpiar} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Limpiar</button>
        )}
      </div>

      <div aria-live="polite" className="flex-1 flex flex-col">
        {error && (
          <div className="my-auto px-3 py-2.5 bg-slate-50 flex items-center gap-2.5 text-slate-700">
            <UserX className="w-5 h-5 text-slate-400 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {!error && !resultado && (
          <div className="my-auto px-3 py-5 @min-[38rem]:py-3 text-center @min-[38rem]:text-left @min-[38rem]:flex items-center justify-center gap-3">
            <IdCard className="w-7 h-7 mx-auto @min-[38rem]:mx-0 shrink-0 text-slate-300" />
            <div>
              <p className="text-sm text-slate-500 font-medium mt-1 @min-[38rem]:mt-0">Esperando el próximo ingreso…</p>
              <p className="text-xs text-slate-500 mt-0.5">Al verificar un DNI aparecen la foto, el plan, la cuota, los días de la semana y el apto médico.</p>
            </div>
          </div>
        )}

        {resultado?.fichada && (
          <FichaPersonal ficha={resultado} onInvertir={invertirFichada} invirtiendo={invirtiendo} />
        )}

        {resultado && !resultado.fichada && (
          // Con lugar: la foto y el nombre a la izquierda, lo que le falta, los botones y los avisos a la derecha, y abajo los
          // días, la cuota y el apto a todo el ancho
          <div className={`flex-1 content-start p-3 grid @min-[38rem]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 ${resultado.permitido ? 'bg-emerald-50/60' : 'bg-rose-50/60'}`}>
            <div className="flex items-start gap-3">
              {resultado.fotoVersion ? (
                // Con foto: recepción compara la cara con la persona que tiene adelante
                <div className="relative shrink-0">
                  <FotoSocio idSocio={resultado.idUsuario} fotoVersion={resultado.fotoVersion} nombre={resultado.nombreSocio}
                    className="w-20 h-20 rounded-xl" texto="text-lg" />
                  <span className={`absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full ring-2 ring-white flex items-center justify-center ${resultado.permitido ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    {resultado.permitido ? <ShieldCheck className="w-4 h-4 text-white" /> : <XCircle className="w-4 h-4 text-white" />}
                  </span>
                </div>
              ) : (
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${resultado.permitido ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                  {resultado.permitido
                    ? <ShieldCheck className="w-6 h-6 text-white" />
                    : <XCircle className="w-6 h-6 text-white" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-black uppercase tracking-widest ${resultado.permitido ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {resultado.permitido ? 'Acceso permitido' : 'Acceso denegado'}
                </p>
                <h3 className="text-lg font-extrabold text-slate-800 leading-tight truncate @min-[38rem]:whitespace-normal @min-[38rem]:line-clamp-2">{resultado.nombreSocio}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  DNI {resultado.dni}
                  {resultado.rol !== 'SOCIO' ? ` · Personal (${resultado.rol})` : ` · ${resultado.plan || 'Sin plan'}`}
                  {' · '}{resultado.fechaHora?.substring(11, 16)} hs
                </p>
                {resultado.rol === 'SOCIO' && !resultado.fotoVersion && (
                  <button type="button" onClick={() => setSacandoFoto(true)}
                    className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-blue-200 bg-white text-blue-600 text-xs font-semibold hover:bg-blue-50">
                    <Camera className="w-3.5 h-3.5" /> No tiene foto: sacarla ahora
                  </button>
                )}
              </div>
            </div>
            <div className="@min-[38rem]:[&>:first-child]:mt-0">
              {sacandoFoto && (
                <CapturaFoto nombre={resultado.nombreSocio} onListo={guardarFoto}
                  onCerrar={() => { setSacandoFoto(false); inputRef.current?.focus(); }} />
              )}

              <FaltasIngreso faltas={resultado.faltas} />

              {cobrado && (
                <p className="mt-2 flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Cobro de {formatMoneda(cobrado.monto)} registrado ({cobrado.plan}).
                </p>
              )}

              {(ofreceCobro || ofreceTerminar || (ofreceExcepcion && excepcion === null)) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ofreceCobro && (
                    <button type="button" onClick={() => setCobrando(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 tactil:min-h-11 rounded-lg bg-exito hover:bg-exito-oscuro text-white text-xs font-bold transition-colors">
                      <Wallet className="w-3.5 h-3.5" /> {resultado.vencimientoCuota ? 'Cobrar la cuota' : 'Cobrar un plan'}
                    </button>
                  )}
                  {ofreceTerminar && (
                    <button type="button" onClick={terminarYVerificar} disabled={terminando?.enviando}
                      title="Se le descuentan del vencimiento los días que no usó y se vuelve a verificar el ingreso"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 tactil:min-h-11 rounded-lg bg-info hover:bg-info-oscuro text-white text-xs font-bold transition-colors disabled:opacity-50">
                      <Snowflake className="w-3.5 h-3.5" /> {terminando?.enviando ? 'Terminando...' : 'Volvió antes: terminar el congelamiento'}
                    </button>
                  )}
                  {ofreceExcepcion && excepcion === null && (
                    <button type="button" onClick={() => setExcepcion({ motivo: '', enviando: false, error: '' })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 tactil:min-h-11 rounded-lg bg-alerta hover:bg-alerta-oscuro text-white text-xs font-bold transition-colors">
                      <DoorOpen className="w-3.5 h-3.5" /> Dejar pasar igual (excepción)
                    </button>
                  )}
                </div>
              )}
              {terminando?.error && <p className="mt-1 text-xs text-rose-700 font-medium">{terminando.error}</p>}
              {cobrando && (
                <CobroRapido idSocio={resultado.idUsuario} onClose={() => setCobrando(false)} onCobrado={alCobrar} />
              )}

              {ofreceExcepcion && excepcion !== null && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-white p-2.5 space-y-1.5">
                  <p className="text-xs font-semibold text-slate-800">¿Por qué lo dejás pasar?</p>
                  <input autoFocus value={excepcion.motivo} maxLength={200}
                    onChange={e => setExcepcion({ ...excepcion, motivo: e.target.value })}
                    placeholder="Ej.: pagó por transferencia y se acredita mañana"
                    className="w-full px-2.5 py-1.5 tactil:py-2.5 border border-slate-200 rounded-lg text-sm tactil:text-base focus:outline-hidden focus:ring-2 focus:ring-amber-100" />
                  <p className="text-xs text-slate-500">Queda registrado con tu nombre. Con el apto médico vencido no se puede.</p>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={confirmarExcepcion} disabled={excepcion.enviando || excepcion.motivo.trim().length < 5}
                      className="px-2.5 py-1.5 tactil:min-h-11 rounded-lg bg-alerta hover:bg-alerta-oscuro text-white text-xs font-bold disabled:opacity-50">
                      {excepcion.enviando ? 'Registrando...' : 'Confirmar ingreso'}
                    </button>
                    <button type="button" onClick={() => setExcepcion(null)}
                      className="px-2.5 py-1.5 tactil:min-h-11 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50">
                      Cancelar
                    </button>
                  </div>
                  {excepcion.error && <p className="text-xs text-rose-700 font-medium">{excepcion.error}</p>}
                </div>
              )}

              {resultado.permitido && resultado.mensaje?.startsWith('Ingreso por excepción') && (
                <p className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                  <DoorOpen className="w-3.5 h-3.5 mt-px shrink-0" /> {resultado.mensaje}
                </p>
              )}

              <AvisosIngreso avisos={resultado.avisos} />
            </div>

            {resultado.rol === 'SOCIO' && (
              <DatosFicha ficha={resultado}
                className="@min-[38rem]:col-span-2" />
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ControlAcceso;
