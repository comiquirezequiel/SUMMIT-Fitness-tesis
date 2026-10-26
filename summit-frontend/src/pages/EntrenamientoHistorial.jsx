import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarDays, Gauge, Weight, CalendarCheck, ChevronDown, Download, TrendingUp, History, CalendarClock, MessageSquare,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import BuscadorSocio from '../components/entrenamiento/BuscadorSocio';
import GraficoProgreso from '../components/entrenamiento/GraficoProgreso';
import { Cargando, ErrorCaja, Vacio } from '../components/entrenamiento/Estados';
import {
  useSocios, obtenerJson, formatTonelaje, formatNumero, haceCuanto, fechaCorta, claseRpe, nombreGrupo,
  seriesPorReps, formatKg,
} from '../components/entrenamiento/comun';
import { inputClass } from '../components/Campo';
import { formatFecha, descargarCsv, hoyIso } from '../utils/formato';

const PERIODOS = [30, 90, 180, 365];
const SESIONES_POR_PAGINA = 10;

// 'YYYY-MM-DD' menos n días (fecha local)
const restarDias = (iso, dias) => {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d - dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};

const claveSesion = (s) => `${s.fecha}-${s.idRutina}-${s.diaNumero}`;

/**
 * Historial de entrenamiento de un socio: resumen del período, sesiones con su detalle
 * y gráfico de progreso por ejercicio (peso y RPE o volumen).
 */
const EntrenamientoHistorial = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { socios, cargando: cargandoSocios, error: errorSocios, recargar: recargarSocios } = useSocios();
  const idSocio = params.get('socio');
  const socio = socios.find((s) => String(s.idSocio) === idSocio) || null;

  const [periodo, setPeriodo] = useState(90);
  const [sesiones, setSesiones] = useState({ datos: [], cargando: false, error: '' });
  const [mostrar, setMostrar] = useState(SESIONES_POR_PAGINA);
  const [abierta, setAbierta] = useState(null);
  const [detalles, setDetalles] = useState({}); // fecha -> { cargando, error, registros }
  const [ejercicios, setEjercicios] = useState({ datos: [], cargando: false, error: '' });
  const [idEjercicio, setIdEjercicio] = useState('');
  const [progreso, setProgreso] = useState({ datos: [], cargando: false, error: '' });
  const [recarga, setRecarga] = useState(0);

  const elegirSocio = (s) => setParams(s ? { socio: String(s.idSocio) } : {});

  // Sesiones del período
  useEffect(() => {
    if (!idSocio) return undefined;
    let vigente = true;
    setSesiones((s) => ({ ...s, cargando: true, error: '' }));
    setAbierta(null);
    setMostrar(SESIONES_POR_PAGINA);
    const hoy = hoyIso();
    obtenerJson(`/entrenamientos/socio/${idSocio}/sesiones?desde=${restarDias(hoy, periodo)}&hasta=${hoy}`,
      'No se pudo cargar el historial de sesiones.')
      .then((datos) => { if (vigente) setSesiones({ datos, cargando: false, error: '' }); })
      .catch((e) => { if (vigente) setSesiones({ datos: [], cargando: false, error: e.message }); });
    return () => { vigente = false; };
  }, [idSocio, periodo, recarga]);

  // Ejercicios con historial (para elegir cuál graficar): por defecto, el más registrado
  useEffect(() => {
    if (!idSocio) return undefined;
    let vigente = true;
    setDetalles({});
    setEjercicios({ datos: [], cargando: true, error: '' });
    setIdEjercicio('');
    obtenerJson(`/entrenamientos/socio/${idSocio}/ejercicios`, 'No se pudieron cargar los ejercicios del socio.')
      .then((datos) => {
        if (!vigente) return;
        setEjercicios({ datos, cargando: false, error: '' });
        const masRegistrado = datos.reduce((m, e) => (!m || e.registros > m.registros ? e : m), null);
        setIdEjercicio(masRegistrado ? String(masRegistrado.idEjercicio) : '');
      })
      .catch((e) => { if (vigente) setEjercicios({ datos: [], cargando: false, error: e.message }); });
    return () => { vigente = false; };
  }, [idSocio, recarga]);

  // Progreso del ejercicio elegido
  useEffect(() => {
    if (!idSocio || !idEjercicio) { setProgreso({ datos: [], cargando: false, error: '' }); return undefined; }
    let vigente = true;
    setProgreso((p) => ({ ...p, cargando: true, error: '' }));
    obtenerJson(`/entrenamientos/socio/${idSocio}/progreso?idEjercicio=${idEjercicio}`, 'No se pudo cargar el progreso.')
      .then((datos) => { if (vigente) setProgreso({ datos, cargando: false, error: '' }); })
      .catch((e) => { if (vigente) setProgreso({ datos: [], cargando: false, error: e.message }); });
    return () => { vigente = false; };
  }, [idSocio, idEjercicio]);

  const resumen = useMemo(() => {
    const lista = sesiones.datos;
    const registros = lista.reduce((t, s) => t + s.ejerciciosRegistrados, 0);
    const rpe = registros ? lista.reduce((t, s) => t + (s.rpePromedio || 0) * s.ejerciciosRegistrados, 0) / registros : null;
    return {
      cantidad: lista.length,
      porSemana: lista.length / (periodo / 7),
      rpe,
      tonelaje: lista.reduce((t, s) => t + (s.tonelajeKg || 0), 0),
      ultima: lista[0]?.fecha || null,
    };
  }, [sesiones.datos, periodo]);

  const abrirSesion = async (s) => {
    const clave = claveSesion(s);
    if (abierta === clave) { setAbierta(null); return; }
    setAbierta(clave);
    if (detalles[s.fecha]?.registros) return;
    setDetalles((d) => ({ ...d, [s.fecha]: { cargando: true, error: '', registros: null } }));
    try {
      const registros = await obtenerJson(`/entrenamientos/socio/${idSocio}?fecha=${s.fecha}`, 'No se pudo cargar el detalle de la sesión.');
      setDetalles((d) => ({ ...d, [s.fecha]: { cargando: false, error: '', registros } }));
    } catch (e) {
      setDetalles((d) => ({ ...d, [s.fecha]: { cargando: false, error: e.message, registros: null } }));
    }
  };

  const exportar = () => {
    descargarCsv(`historial-${(socio?.nombreCompleto || 'socio').replace(/\s+/g, '-').toLowerCase()}-${hoyIso()}.csv`,
      ['Fecha', 'Rutina', 'Día', 'Ejercicios registrados', 'RPE promedio', 'Tonelaje (kg)'],
      sesiones.datos.map((s) => [formatFecha(s.fecha), s.nombreRutina, s.diaNumero, s.ejerciciosRegistrados,
        s.rpePromedio !== null ? formatNumero(s.rpePromedio) : '', formatNumero(s.tonelajeKg, 1)]));
  };

  const ejercicioElegido = ejercicios.datos.find((e) => String(e.idEjercicio) === idEjercicio);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Historial de entrenamiento</h1>
        <p className="text-sm text-slate-500">Sesiones, esfuerzo y progreso de cada socio a partir de lo que registra en su rutina</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        {/* En fila recién desde 1024 px: con el menú lateral, la tablet parada deja poco ancho para el buscador */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1 min-w-0">
            <BuscadorSocio socios={socios} cargando={cargandoSocios} error={errorSocios} seleccionado={socio} onSeleccionar={elegirSocio} />
          </div>
          {socio && (
            <div className="flex gap-2 shrink-0">
              <label className="sr-only" htmlFor="periodo">Período</label>
              <select id="periodo" value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))} className={`${inputClass} flex-1 lg:flex-none lg:w-auto min-w-0`}>
                {PERIODOS.map((p) => <option key={p} value={p}>Últimos {p} días</option>)}
              </select>
              <button onClick={() => navigate(`/entrenamiento/hoy?socio=${socio.idSocio}`)}
                className="px-3 py-2 tactil:min-h-11 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap">
                <CalendarClock className="w-4 h-4" /> Rutina de hoy
              </button>
            </div>
          )}
        </div>
      </div>

      {errorSocios ? (
        <ErrorCaja mensaje={errorSocios} onReintentar={recargarSocios} />
      ) : !idSocio ? (
        <div className="bg-white border border-slate-200 rounded-xl">
          <Vacio icono={History} titulo="Elegí un socio para ver su historial">
            Buscalo por nombre, DNI o email. Vas a ver sus sesiones y el gráfico de progreso de cada ejercicio.
          </Vacio>
        </div>
      ) : cargandoSocios ? (
        <Cargando texto="Cargando socio..." />
      ) : !socio ? (
        <ErrorCaja mensaje="No encontramos ese socio." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={`Sesiones (${periodo} días)`} value={sesiones.cargando ? '…' : String(resumen.cantidad)} icon={CalendarDays}
              iconColor="text-blue-500" iconBg="bg-blue-50" subtitle={`${formatNumero(resumen.porSemana, 1)} por semana`} />
            <StatCard title="RPE promedio" value={sesiones.cargando ? '…' : (resumen.rpe !== null ? formatNumero(resumen.rpe, 1) : '—')} icon={Gauge}
              iconColor="text-orange-500" iconBg="bg-orange-50" subtitle="Esfuerzo percibido, de 1 a 10" />
            <StatCard title="Tonelaje total" value={sesiones.cargando ? '…' : formatTonelaje(resumen.tonelaje)} icon={Weight}
              iconColor="text-indigo-500" iconBg="bg-indigo-50" subtitle="Peso × repeticiones × series" />
            <StatCard title="Último entrenamiento" value={sesiones.cargando ? '…' : (resumen.ultima ? fechaCorta(resumen.ultima).split(' ')[1] : '—')}
              icon={CalendarCheck} iconColor="text-emerald-500" iconBg="bg-emerald-50"
              subtitle={resumen.ultima ? `${haceCuanto(resumen.ultima)} · ${formatFecha(resumen.ultima)}` : `Sin entrenamientos en ${periodo} días`} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
            {/* Gráfico de progreso. GraficoProgreso lo comparte la app del socio: sus botones se agrandan acá, en el celular
                y la tablet, sin cambiar el componente */}
            <section className="xl:col-span-3 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4 min-w-0 tactil:[&_button]:min-h-11 tactil:[&_button]:px-3.5">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="font-bold text-slate-800 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600" /> Progreso por ejercicio</h2>
                {ejercicios.datos.length > 0 && (
                  <select value={idEjercicio} onChange={(e) => setIdEjercicio(e.target.value)} aria-label="Ejercicio a graficar"
                    className={`${inputClass} sm:w-72`}>
                    {ejercicios.datos.map((e) => (
                      <option key={e.idEjercicio} value={e.idEjercicio}>
                        {e.nombreEjercicio} · {nombreGrupo(e.grupoMuscular)} ({e.registros} {e.registros === 1 ? 'registro' : 'registros'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {ejercicios.cargando ? <Cargando texto="Cargando ejercicios..." />
                : ejercicios.error ? <ErrorCaja mensaje={ejercicios.error} onReintentar={() => setRecarga((n) => n + 1)} />
                  : ejercicios.datos.length === 0 ? (
                    <Vacio icono={TrendingUp} titulo="Todavía no hay registros para graficar">
                      Cuando el socio (o el profesor por él) cargue peso y RPE de su rutina, acá se ve la evolución.
                    </Vacio>
                  ) : progreso.cargando && progreso.datos.length === 0 ? <Cargando texto="Cargando progreso..." />
                    : progreso.error ? <ErrorCaja mensaje={progreso.error} />
                      : <GraficoProgreso datos={progreso.datos} nombreEjercicio={ejercicioElegido?.nombreEjercicio || ''} />}
            </section>

            {/* Sesiones */}
            <section className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-w-0">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-blue-600" /> Sesiones</h2>
                <button onClick={exportar} disabled={sesiones.datos.length === 0}
                  className="px-3 py-1.5 tactil:min-h-11 tactil:px-4 text-xs tactil:text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Exportar CSV
                </button>
              </div>
              {sesiones.cargando ? <Cargando texto="Cargando sesiones..." />
                : sesiones.error ? <div className="p-4"><ErrorCaja mensaje={sesiones.error} onReintentar={() => setRecarga((n) => n + 1)} /></div>
                  : sesiones.datos.length === 0 ? (
                    <Vacio icono={CalendarDays} titulo={`Sin entrenamientos en los últimos ${periodo} días`}>Probá con un período más largo.</Vacio>
                  ) : (
                    <>
                      <ul className="divide-y divide-slate-100">
                        {sesiones.datos.slice(0, mostrar).map((s) => {
                          const clave = claveSesion(s);
                          const abiertaEsta = abierta === clave;
                          const detalle = detalles[s.fecha];
                          const registros = detalle?.registros?.filter((r) => r.idRutina === s.idRutina && r.diaNumero === s.diaNumero) || [];
                          return (
                            <li key={clave}>
                              <button onClick={() => abrirSesion(s)} aria-expanded={abiertaEsta}
                                className="w-full text-left px-4 sm:px-5 py-3 hover:bg-slate-50 flex items-center gap-3">
                                <div className="w-12 text-center shrink-0">
                                  <p className="text-[11px] uppercase font-bold text-slate-400">{fechaCorta(s.fecha).split(' ')[0]}</p>
                                  <p className="text-sm font-bold text-slate-800">{fechaCorta(s.fecha).split(' ')[1]}</p>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{s.nombreRutina} · Día {s.diaNumero}</p>
                                  <p className="text-xs text-slate-500">
                                    {s.ejerciciosRegistrados} {s.ejerciciosRegistrados === 1 ? 'ejercicio' : 'ejercicios'} · {formatTonelaje(s.tonelajeKg)}
                                  </p>
                                </div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded border shrink-0 ${claseRpe(s.rpePromedio)}`} title="RPE promedio">
                                  RPE {s.rpePromedio !== null ? formatNumero(s.rpePromedio) : '—'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${abiertaEsta ? 'rotate-180' : ''}`} />
                              </button>
                              {abiertaEsta && (
                                <div className="px-4 sm:px-5 pb-4 bg-slate-50/60">
                                  {!detalle || detalle.cargando ? <Cargando texto="Cargando detalle..." />
                                    : detalle.error ? <ErrorCaja mensaje={detalle.error} />
                                      : registros.length === 0 ? <p className="text-sm text-slate-500 py-3">Sin registros para esta sesión.</p>
                                        : (
                                          <ul className="space-y-2 pt-3">
                                            {registros.map((r) => (
                                              <li key={r.idLog} className="bg-white border border-slate-200 rounded-lg p-3">
                                                <div className="flex justify-between gap-2">
                                                  <p className="text-sm font-semibold text-slate-800">{r.nombreEjercicio}</p>
                                                  <span className={`text-xs font-bold px-2 py-0.5 rounded border h-fit ${claseRpe(r.rpe)}`}>RPE {r.rpe}</span>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-0.5">{formatKg(r.pesoKg)} · {seriesPorReps(r.series, r.repeticiones)}</p>
                                                {r.comentario && (
                                                  <p className="text-xs text-slate-500 italic mt-1 flex gap-1"><MessageSquare className="w-3.5 h-3.5 shrink-0 mt-px" />{r.comentario}</p>
                                                )}
                                                <p className="text-[11px] text-slate-400 mt-1">Cargó: {r.registradoPor}</p>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {sesiones.datos.length > mostrar && (
                        <button onClick={() => setMostrar((m) => m + SESIONES_POR_PAGINA)}
                          className="w-full py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 border-t border-slate-100">
                          Mostrar más ({sesiones.datos.length - mostrar} restantes)
                        </button>
                      )}
                    </>
                  )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default EntrenamientoHistorial;
