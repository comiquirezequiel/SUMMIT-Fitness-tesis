import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarCheck, RefreshCw, Users, Dumbbell, ClipboardList, Plus, History, Pencil } from 'lucide-react';
import BuscadorSocio from '../components/entrenamiento/BuscadorSocio';
import EjercicioDelDia from '../components/entrenamiento/EjercicioDelDia';
import { Cargando, ErrorCaja, Vacio, Aviso } from '../components/entrenamiento/Estados';
import {
  useSocios, obtenerJson, puedeEditarEntrenamiento, claseRpe, formatNumero, horaCorta,
} from '../components/entrenamiento/comun';
import { formatFecha, usuarioActual } from '../utils/formato';

const REFRESCO_MS = 60000; // "Entrenando hoy" se actualiza solo cada minuto

/**
 * Rutina de hoy, para el profesor en el salón: quiénes están entrenando (con su avance)
 * y la rutina del día de un socio para cargarle peso, repeticiones, series y RPE.
 */
const EntrenamientoHoy = () => {
  const navigate = useNavigate();
  const puedeCargar = puedeEditarEntrenamiento(usuarioActual());
  const [params, setParams] = useSearchParams();
  const idSocio = params.get('socio');
  const diaParam = params.get('dia');
  const { socios, cargando: cargandoSocios, error: errorSocios, recargar: recargarSocios } = useSocios();
  const socio = socios.find((s) => String(s.idSocio) === idSocio) || null;
  const rutinaRef = useRef(null);

  const [enSala, setEnSala] = useState({ datos: [], cargando: true, error: '', hora: '' });
  const [hoy, setHoy] = useState({ idSocio: null, datos: null, cargando: false, error: '', sinRutina: false });
  const [diaSugerido, setDiaSugerido] = useState({ idSocio: null, dia: null });
  const [aviso, setAviso] = useState(null);
  const [recarga, setRecarga] = useState(0);

  const cargarEnSala = useCallback(async () => {
    setEnSala((e) => ({ ...e, cargando: true }));
    try {
      const datos = await obtenerJson('/entrenamientos/hoy', 'No se pudo cargar quiénes entrenan hoy.');
      const ahora = new Date();
      setEnSala({ datos, cargando: false, error: '', hora: ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) });
    } catch (e) {
      setEnSala((s) => ({ ...s, cargando: false, error: e.message }));
    }
  }, []);

  useEffect(() => {
    cargarEnSala();
    const intervalo = setInterval(cargarEnSala, REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [cargarEnSala]);

  // Rutina del día del socio elegido (?dia=N para ver otro día)
  useEffect(() => {
    if (!idSocio) { setHoy({ idSocio: null, datos: null, cargando: false, error: '', sinRutina: false }); return undefined; }
    let vigente = true;
    // Otro socio: no se muestra la rutina del anterior mientras carga la nueva
    setHoy((h) => (h.idSocio === idSocio ? { ...h, cargando: true, error: '' }
      : { idSocio, datos: null, cargando: true, error: '', sinRutina: false }));
    obtenerJson(`/rutinas/socio/${idSocio}/hoy${diaParam ? `?dia=${diaParam}` : ''}`, 'No se pudo cargar la rutina del día.')
      .then((datos) => {
        if (!vigente) return;
        setHoy({ idSocio, datos, cargando: false, error: '', sinRutina: false });
        if (!diaParam) setDiaSugerido({ idSocio, dia: datos.diaNumero });
      })
      .catch((e) => {
        if (!vigente) return;
        if (e.status === 404) setHoy({ idSocio, datos: null, cargando: false, error: '', sinRutina: true });
        else setHoy({ idSocio, datos: null, cargando: false, error: e.message, sinRutina: false });
      });
    return () => { vigente = false; };
  }, [idSocio, diaParam, recarga]);

  const elegirSocio = (s, desplazar = false) => {
    setAviso(null);
    setParams(s ? { socio: String(s.idSocio) } : {});
    if (desplazar) setTimeout(() => rutinaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const elegirDia = (dia) => setParams({ socio: idSocio, dia: String(dia) });

  const despuesDeCambiar = (nuevoAviso) => {
    setAviso(nuevoAviso);
    setRecarga((n) => n + 1);
    cargarEnSala();
  };

  // Lo cargado corresponde al socio elegido (si se acaba de cambiar, todavía está cargando)
  const actual = hoy.idSocio === idSocio ? hoy : { datos: null, cargando: true, error: '', sinRutina: false };
  const rutina = actual.datos;
  const sugerido = diaSugerido.idSocio === idSocio ? diaSugerido.dia : null;
  const registradosHoy = rutina ? rutina.ejercicios.filter((e) => e.registroHoy).length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Rutina de hoy</h1>
        <p className="text-sm text-slate-500">Quiénes están entrenando y la rutina del día de cada socio, para acompañarlo en el salón</p>
      </div>

      {/* Entrenando hoy */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Entrenando hoy
              {!enSala.cargando && !enSala.error && <span className="text-sm font-semibold text-slate-400">({enSala.datos.length})</span>}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Socios que registraron algo hoy{enSala.hora && ` · actualizado ${enSala.hora}`}</p>
          </div>
          <button onClick={cargarEnSala} title="Actualizar" aria-label="Actualizar quiénes entrenan hoy"
            className="border border-slate-200 rounded-lg p-2 text-slate-500 hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 ${enSala.cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="p-4 sm:p-5">
          {enSala.error ? <ErrorCaja mensaje={enSala.error} onReintentar={cargarEnSala} />
            : enSala.cargando && enSala.datos.length === 0 ? <Cargando texto="Buscando quiénes entrenan hoy..." />
              : enSala.datos.length === 0 ? (
                <Vacio icono={Dumbbell} titulo="Nadie registró entrenamientos hoy todavía">
                  Cuando un socio cargue su rutina desde el portal (o se la cargues vos) aparece acá.
                </Vacio>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {enSala.datos.map((s) => {
                    const total = Math.max(s.totalEjercicios, s.ejerciciosRegistrados, 1);
                    const porcentaje = Math.round((s.ejerciciosRegistrados / total) * 100);
                    const elegido = String(s.idSocio) === idSocio;
                    return (
                      <li key={`${s.idSocio}-${s.idRutina}-${s.diaNumero}`}>
                        <button onClick={() => elegirSocio({ idSocio: s.idSocio }, true)}
                          className={`w-full text-left p-4 rounded-xl border transition-colors ${elegido ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}>
                          <div className="flex justify-between gap-2">
                            <p className="font-semibold text-slate-800 truncate">{s.nombreSocio}</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded border shrink-0 h-fit ${claseRpe(s.rpePromedio)}`}>
                              RPE {s.rpePromedio !== null ? formatNumero(s.rpePromedio) : '—'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{s.nombreRutina} · Día {s.diaNumero}</p>
                          <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar"
                            aria-valuenow={s.ejerciciosRegistrados} aria-valuemin={0} aria-valuemax={total}
                            aria-label={`${s.ejerciciosRegistrados} de ${s.totalEjercicios} ejercicios`}>
                            <div className={`h-full rounded-full ${porcentaje >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(porcentaje, 100)}%` }} />
                          </div>
                          <div className="flex justify-between mt-1.5 text-xs text-slate-500">
                            <span><b className="text-slate-700">{s.ejerciciosRegistrados}</b> de {s.totalEjercicios} ejercicios</span>
                            {s.ultimoRegistro && <span>Última carga {horaCorta(s.ultimoRegistro)}</span>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
        </div>
      </section>

      {/* Rutina del día de un socio */}
      <section ref={rutinaRef} className="bg-white border border-slate-200 rounded-xl shadow-sm scroll-mt-4">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 space-y-3">
          <h2 className="font-bold text-slate-800 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-blue-600" /> Rutina del día de un socio</h2>
          <BuscadorSocio socios={socios} cargando={cargandoSocios} error={errorSocios} seleccionado={socio} onSeleccionar={(s) => elegirSocio(s)} />
          {!puedeCargar && (
            <Aviso tipo="info">Modo consulta: los entrenamientos los cargan el socio, los profesores y los administradores.</Aviso>
          )}
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {aviso && <Aviso tipo={aviso.tipo} onCerrar={() => setAviso(null)}>{aviso.texto}</Aviso>}
          {errorSocios ? <ErrorCaja mensaje={errorSocios} onReintentar={recargarSocios} />
            : !idSocio ? (
              <Vacio icono={ClipboardList} titulo="Elegí un socio para ver su rutina de hoy">
                Buscalo arriba o tocá a alguien de &quot;Entrenando hoy&quot;.
              </Vacio>
            ) : actual.cargando && !rutina ? <Cargando texto="Cargando la rutina del día..." />
              : actual.error ? <ErrorCaja mensaje={actual.error} onReintentar={() => setRecarga((n) => n + 1)} />
                : actual.sinRutina ? (
                  <Vacio icono={ClipboardList} titulo={`${socio?.nombreCompleto || 'El socio'} no tiene una rutina activa`}>
                    {puedeCargar && (
                      <button onClick={() => navigate(`/rutinas/constructor?socio=${idSocio}`)}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
                        <Plus className="w-4 h-4" /> Armarle una rutina
                      </button>
                    )}
                  </Vacio>
                ) : rutina && (
                  <>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-slate-800">{rutina.nombreRutina}</p>
                        <p className="text-sm text-slate-500">
                          {formatFecha(rutina.fecha)} · Día {rutina.diaNumero} de {rutina.totalDias}
                          {sugerido && sugerido !== rutina.diaNumero && ` · hoy le toca el Día ${sugerido}`}
                          {sugerido === rutina.diaNumero && ' · es el día que le toca hoy'}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {rutina.yaEntrenoHoy && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">Ya entrenó hoy</span>
                          )}
                          {rutina.ejercicios.length > 0 && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">
                              {registradosHoy} de {rutina.ejercicios.length} registrados hoy
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 lg:items-end">
                        {rutina.totalDias > 1 && (
                          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Día de la rutina">
                            {Array.from({ length: rutina.totalDias }, (_, i) => i + 1).map((d) => (
                              <button key={d} role="tab" aria-selected={rutina.diaNumero === d} onClick={() => elegirDia(d)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${rutina.diaNumero === d
                                  ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                Día {d}{sugerido === d ? ' · hoy' : ''}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => navigate(`/entrenamiento/historial?socio=${idSocio}`)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5" /> Historial
                          </button>
                          {puedeCargar && (
                            <button onClick={() => navigate(`/rutinas/constructor?rutina=${rutina.idRutina}`)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
                              <Pencil className="w-3.5 h-3.5" /> Editar rutina
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {rutina.ejercicios.length === 0 ? (
                      <Vacio icono={Dumbbell} titulo={rutina.totalDias === 0 ? 'La rutina todavía no tiene ejercicios' : `El Día ${rutina.diaNumero} no tiene ejercicios`} />
                    ) : (
                      <ol className={`space-y-3 ${actual.cargando ? 'opacity-60' : ''}`}>
                        {rutina.ejercicios.map((e, i) => (
                          <EjercicioDelDia key={`${e.idRutinaEjercicio}-${JSON.stringify(e.registroHoy)}`} ejercicio={e} numero={i + 1}
                            puedeCargar={puedeCargar} onCambio={despuesDeCambiar} />
                        ))}
                      </ol>
                    )}
                  </>
                )}
        </div>
      </section>
    </div>
  );
};

export default EntrenamientoHoy;
