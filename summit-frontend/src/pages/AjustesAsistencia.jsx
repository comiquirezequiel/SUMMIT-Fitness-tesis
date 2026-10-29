import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import {
  Clipboard, Users, Clock, CalendarDays, AlertTriangle, Download, Plus, ChevronLeft, ChevronRight, ChevronDown,
  Pencil, RefreshCw, Info, LogIn,
} from 'lucide-react';
import TurnoModal from '../components/asistencia/TurnoModal';
import {
  ROLES_PERSONAL, textoRol, duracion, horasDecimales, diaCorto, hora, horaSalida, periodo, moverPeriodo, MODOS,
  ESTADOS_TURNO, ACCIONES_CORRECCION,
} from '../components/asistencia/comun';
import { apiFetch } from '../services/api';
import { descargarCsv, formatFecha, formatFechaHora, hoyIso } from '../utils/formato';

const ACTUALIZAR_CADA_MS = 60000; // "trabajando ahora" y los turnos en curso

const Iniciales = ({ nombre }) => (
  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs shrink-0">
    {nombre.substring(0, 2).toUpperCase()}
  </div>
);

const Tarjeta = ({ titulo, valor, detalle, icon: Icon, color, alerta }) => (
  <div className={`p-5 rounded-xl border shadow-xs flex items-center justify-between ${alerta ? 'bg-rose-50/60 border-rose-200' : 'bg-white border-slate-200'}`}>
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-500 mb-1">{titulo}</p>
      <h3 className={`text-2xl font-bold ${alerta ? 'text-rose-700' : 'text-slate-800'}`}>{valor}</h3>
      {detalle && <p className="text-xs text-slate-500 mt-1">{detalle}</p>}
    </div>
    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="w-6 h-6" />
    </div>
  </div>
);

// Un turno de la planilla: tocándolo se corrige. Sin salida va en rojo; en curso, en verde; anulado, tachado
const ChipTurno = ({ turno, onClick }) => {
  const corregido = turno.correcciones.length > 0;
  let clase = 'bg-white border-slate-200 text-slate-700 hover:border-blue-300';
  let texto = `${hora(turno.entrada)} – ${horaSalida(turno.entrada, turno.salida)}`;
  if (turno.anulado) {
    clase = 'bg-slate-50 border-slate-200 text-slate-400 line-through';
  } else if (turno.estado === 'SIN_SALIDA') {
    clase = 'bg-rose-50 border-rose-300 text-rose-700 hover:border-rose-400';
    texto = `${hora(turno.entrada)} – sin salida`;
  } else if (turno.estado === 'EN_CURSO') {
    clase = 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-300';
    texto = `${hora(turno.entrada)} – en curso`;
  }
  const ultimo = turno.correcciones.at(-1);
  return (
    <button type="button" onClick={onClick}
      title={ultimo ? `${turno.anulado ? 'Anulado' : 'Corregido'} por ${ultimo.autor}: ${ultimo.motivo}` : 'Corregir este turno'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold tabular-nums transition-colors ${clase}`}>
      {turno.estado === 'SIN_SALIDA' && !turno.anulado && <AlertTriangle className="w-3 h-3" />}
      {texto}
      {corregido && <Pencil className="w-3 h-3 opacity-70" aria-label="Corregido" />}
    </button>
  );
};

// Días de una persona en el período: sus turnos, las horas de cada día y los días incompletos marcados
const DetallePersona = ({ persona, onTurno }) => (
  persona.dias.length === 0 ? (
    <p className="pl-9 sm:pl-14 pr-4 py-3 text-sm text-slate-400">No marcó entrada en este período.</p>
  ) : (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-slate-100">
        {persona.dias.map(dia => (
          <tr key={dia.fecha} className={dia.incompleto ? 'bg-rose-50/50' : ''}>
            <td className="pl-9 sm:pl-14 pr-2 sm:pr-4 py-2.5 whitespace-nowrap text-slate-600 font-medium w-24 sm:w-32">{diaCorto(dia.fecha)}</td>
            <td className="px-2 sm:px-4 py-2.5">
              <div className="flex flex-wrap gap-1.5">
                {dia.turnos.map(t => <ChipTurno key={t.idTurno} turno={t} onClick={() => onTurno(t)} />)}
              </div>
            </td>
            <td className="pl-2 pr-3 sm:px-4 py-2.5 text-right whitespace-nowrap sm:w-48">
              {dia.incompleto && (
                <span className="mr-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                  Incompleto
                </span>
              )}
              <span className="font-semibold text-slate-800 tabular-nums">{dia.minutos > 0 ? duracion(dia.minutos) : '—'}</span>
              {dia.enCurso && <span className="block text-[11px] text-emerald-600">+ turno en curso</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
);

/**
 * Asistencia del personal (solo ADMIN): quién está trabajando ahora, los turnos que quedaron sin salida y las horas de
 * cada persona por día, semana o mes, con la planilla para exportar. El equipo marca la entrada y la salida pasando el
 * DNI por el control de acceso de recepción; acá se corrigen los olvidos (queda quién, cuándo y por qué).
 */
const AjustesAsistencia = () => {
  const [modo, setModo] = useState('mes');
  const [referencia, setReferencia] = useState(hoyIso()); // un día del período que se muestra
  const [idUsuario, setIdUsuario] = useState(''); // '' = todo el equipo
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState(null); // turno que se corrige
  const [cargandoTurno, setCargandoTurno] = useState(null); // { idUsuario, dia } para cargar uno olvidado
  const [cambiadas, setCambiadas] = useState(() => new Set()); // personas abiertas o cerradas a mano
  const pedido = useRef(0); // si cambian los filtros mientras carga, la respuesta vieja se descarta

  const p = periodo(modo, referencia);
  const hoy = hoyIso();
  const incluyeHoy = p.desde <= hoy && hoy <= p.hasta;

  const cargar = useCallback(async (silencioso = false) => {
    const numero = ++pedido.current;
    if (!silencioso) setCargando(true);
    try {
      const filtro = idUsuario ? `&idUsuario=${idUsuario}` : '';
      const res = await apiFetch(`/asistencia/personal?desde=${p.desde}&hasta=${p.hasta}${filtro}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(res.status === 403 ? 'Solo el administrador ve la asistencia del personal.'
          : json.error || 'No se pudo cargar la asistencia del personal.');
      }
      if (numero === pedido.current) {
        setDatos(json);
        setError('');
      }
    } catch (err) {
      if (numero === pedido.current) setError(err.message);
    } finally {
      if (numero === pedido.current) setCargando(false);
    }
  }, [p.desde, p.hasta, idUsuario]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const intervalo = setInterval(() => { if (!document.hidden) cargar(true); }, ACTUALIZAR_CADA_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  // Por persona: en un día o con una sola persona, el detalle se ve abierto; en semana o mes, cerrado. Quien no trabajó
  // en el período queda cerrado (si se abre, lo dice)
  useEffect(() => { setCambiadas(new Set()); }, [modo, idUsuario]);
  const abiertaPorDefecto = modo === 'dia' || idUsuario !== '';
  const abierta = (pp) => (pp.dias.length > 0 && abiertaPorDefecto) !== cambiadas.has(pp.idUsuario);
  const alternar = (id) => setCambiadas(actual => {
    const nuevo = new Set(actual);
    if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
    return nuevo;
  });

  const guardado = (mensaje) => {
    setEditando(null);
    setCargandoTurno(null);
    setAviso(mensaje);
    cargar(true);
  };

  const personas = datos?.personas || [];
  const totales = datos?.totales;
  const sinSalida = datos?.sinSalida || [];
  const trabajando = datos?.trabajandoAhora || [];
  const rango = datos ? `${formatFecha(datos.desde)} al ${formatFecha(datos.hasta)}` : '';

  const exportarResumen = () => descargarCsv(`asistencia-personal-${p.archivo}-resumen.csv`,
    ['Persona', 'DNI', 'Rol', 'Período', 'Días trabajados', 'Días incompletos (sin salida)', 'Horas (decimal)', 'Horas'],
    personas.map(pp => [pp.nombre, pp.dni, textoRol(pp.rol), rango, pp.diasTrabajados, pp.diasIncompletos,
      horasDecimales(pp.minutos), duracion(pp.minutos)]));

  const exportarDetalle = () => descargarCsv(`asistencia-personal-${p.archivo}-detalle.csv`,
    ['Persona', 'DNI', 'Rol', 'Día', 'Entrada', 'Salida', 'Horas (decimal)', 'Horas', 'Estado', 'Correcciones'],
    personas.flatMap(pp => pp.dias.flatMap(dia => dia.turnos.map(t => {
      const suma = !t.anulado && t.estado === 'COMPLETO';
      return [pp.nombre, pp.dni, textoRol(pp.rol), formatFecha(dia.fecha), hora(t.entrada), horaSalida(t.entrada, t.salida),
        suma ? horasDecimales(t.minutos) : '', suma ? duracion(t.minutos) : '',
        t.anulado ? 'Anulado (no suma)' : ESTADOS_TURNO[t.estado]?.texto || t.estado,
        t.correcciones.map(c => `${ACCIONES_CORRECCION[c.accion] || c.accion} por ${c.autor} el ${formatFechaHora(c.fecha)}: ${c.motivo}`).join(' | ')];
    }))));

  const hayTurnos = personas.some(pp => pp.dias.length > 0);

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
            <Clipboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Asistencia del personal</h1>
            <p className="text-sm text-slate-500">Entradas, salidas y horas trabajadas del equipo</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCargandoTurno({ idUsuario: idUsuario || '', dia: incluyeHoy ? hoy : p.hasta })}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xs">
            <Plus className="w-4 h-4" /> Cargar turno
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
        <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
        <p>
          Cada persona del equipo pasa su DNI por el <b>Control de acceso</b> del Dashboard al llegar y al irse: el primer paso
          marca la entrada y el siguiente, la salida. Un turno que pasa la medianoche cuenta en el día en que empezó. Si alguien
          se olvidó, tocá el turno para corregirlo o usá <b>Cargar turno</b>: queda registrado quién lo corrigió, cuándo y por qué.
        </p>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>}
      {aviso && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium">{aviso}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-5" aria-label="Trabajando ahora">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="font-semibold text-slate-800">Trabajando ahora</h2>
              <p className="text-xs text-slate-500">Marcaron la entrada y todavía no la salida</p>
            </div>
            <span className="text-3xl font-bold text-slate-800">{datos ? trabajando.length : '—'}</span>
          </div>
          {datos && trabajando.length === 0 && <p className="text-sm text-slate-400 py-2">Nadie del equipo está trabajando ahora.</p>}
          <div className="divide-y divide-slate-100">
            {trabajando.map(t => (
              <button key={t.idTurno} type="button" onClick={() => setEditando(t)} title="Corregir este turno"
                className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-slate-50 rounded-lg px-1 transition-colors">
                <Iniciales nombre={t.nombre} />
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{t.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {textoRol(t.rol)} · entró a las {hora(t.entrada)}{t.entrada.substring(0, 10) !== hoy ? ` del ${diaCorto(t.entrada)}` : ''}
                  </p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> {duracion(t.minutos)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={`rounded-xl border shadow-xs p-5 ${sinSalida.length ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-slate-200'}`}
          aria-label="Turnos sin salida">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className={`font-semibold flex items-center gap-2 ${sinSalida.length ? 'text-rose-800' : 'text-slate-800'}`}>
                {sinSalida.length > 0 && <AlertTriangle className="w-4 h-4" />} Turnos sin salida
              </h2>
              <p className="text-xs text-slate-500">Últimos 31 días: no marcaron la salida y no suman horas hasta corregirlos</p>
            </div>
            <span className={`text-3xl font-bold ${sinSalida.length ? 'text-rose-700' : 'text-slate-800'}`}>{datos ? sinSalida.length : '—'}</span>
          </div>
          {datos && sinSalida.length === 0 && <p className="text-sm text-slate-400 py-2">No hay turnos incompletos.</p>}
          <div className="divide-y divide-rose-100">
            {sinSalida.map(t => (
              <div key={t.idTurno} className="flex items-center gap-3 py-2.5">
                <Iniciales nombre={t.nombre} />
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{t.nombre}</p>
                  <p className="text-xs text-slate-500">{diaCorto(t.entrada)} · entró a las {hora(t.entrada)}</p>
                </div>
                <button type="button" onClick={() => setEditando(t)}
                  className="ml-auto px-3 py-1.5 rounded-lg border border-rose-200 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50 whitespace-nowrap">
                  Cargar salida
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" aria-label="Horas del período">
        <div className="p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-slate-400" /> {p.titulo.charAt(0).toUpperCase() + p.titulo.slice(1)}
              </h2>
              <p className="text-xs text-slate-500">Horas por persona y por día · solo suman los turnos completos</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={exportarResumen} disabled={personas.length === 0}
                className="bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50 shadow-xs">
                <Download className="w-4 h-4" /> Resumen (CSV)
              </button>
              <button onClick={exportarDetalle} disabled={!hayTurnos}
                className="bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50 shadow-xs">
                <Download className="w-4 h-4" /> Detalle por turno (CSV)
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs font-semibold" role="group" aria-label="Período">
              {MODOS.map(m => (
                <button key={m.clave} onClick={() => setModo(m.clave)}
                  className={`px-3 py-1.5 rounded-md transition-colors ${modo === m.clave ? 'bg-white shadow-xs text-slate-800' : 'text-slate-500'}`}>
                  {m.texto}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setReferencia(moverPeriodo(modo, referencia, -1))} title="Anterior"
                className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {modo === 'mes' ? (
                <input type="month" aria-label="Mes" value={referencia.substring(0, 7)} max={hoy.substring(0, 7)}
                  onChange={e => e.target.value && setReferencia(`${e.target.value}-01`)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
              ) : (
                <input type="date" aria-label={modo === 'dia' ? 'Día' : 'Un día de la semana'} value={referencia} max={hoy}
                  onChange={e => e.target.value && setReferencia(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
              )}
              <button onClick={() => setReferencia(moverPeriodo(modo, referencia, 1))} disabled={incluyeHoy} title="Siguiente"
                className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
              {!incluyeHoy && (
                <button onClick={() => setReferencia(hoy)} className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg">
                  Volver a hoy
                </button>
              )}
            </div>
            <select aria-label="Persona" value={idUsuario} onChange={e => setIdUsuario(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white sm:ml-auto max-w-full">
              <option value="">Todo el equipo</option>
              {(datos?.equipo || []).map(m => (
                <option key={m.idUsuario} value={m.idUsuario}>{m.nombre} ({textoRol(m.rol)}){m.activo ? '' : ' · inactivo'}</option>
              ))}
            </select>
            <button onClick={() => cargar()} title="Actualizar" className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {totales && (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 border-b border-slate-100 bg-slate-50/40">
            <Tarjeta titulo="Horas trabajadas" valor={duracion(totales.minutos)} detalle={`${horasDecimales(totales.minutos)} h en decimal`}
              icon={Clock} color="bg-blue-50 text-blue-600" />
            <Tarjeta titulo="Días trabajados" valor={totales.diasTrabajados}
              detalle={idUsuario ? 'Días con algún turno' : 'Sumando los de cada persona'} icon={CalendarDays} color="bg-violet-50 text-violet-600" />
            <Tarjeta titulo="Personas que trabajaron" valor={totales.personasQueTrabajaron} detalle={`de ${personas.length} en la lista`}
              icon={Users} color="bg-emerald-50 text-emerald-600" />
            <Tarjeta titulo="Turnos sin salida" valor={totales.turnosSinSalida} alerta={totales.turnosSinSalida > 0}
              detalle={totales.turnosSinSalida > 0 ? 'En el período: no suman hasta corregirlos' : 'En el período'}
              icon={AlertTriangle} color={totales.turnosSinSalida > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'} />
          </div>
        )}

        {!datos ? (
          <div className="p-10 text-center text-sm text-slate-400">{cargando ? 'Cargando…' : ''}</div>
        ) : personas.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Todavía no hay personal cargado: se da de alta en Ajustes &gt; Equipo.
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${cargando ? 'opacity-60' : ''}`}>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-3 sm:px-6 py-3">Persona</th>
                  <th className="px-2 sm:px-4 py-3 text-right">Días</th>
                  <th className="px-2 sm:px-4 py-3 text-right">Horas</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-right">Sin salida</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-right"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {personas.map(pp => {
                  const rol = ROLES_PERSONAL[pp.rol];
                  const abiertaFila = abierta(pp);
                  const incompletos = pp.diasIncompletos > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 whitespace-nowrap">
                      <AlertTriangle className="w-3 h-3" /> {pp.diasIncompletos} {pp.diasIncompletos === 1 ? 'día' : 'días'}
                    </span>
                  );
                  return (
                    <Fragment key={pp.idUsuario}>
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-3 sm:px-6 py-3">
                          <button type="button" onClick={() => alternar(pp.idUsuario)} aria-expanded={abiertaFila}
                            className="flex items-center gap-2 sm:gap-3 text-left">
                            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${abiertaFila ? '' : '-rotate-90'}`} />
                            <span className="hidden sm:block"><Iniciales nombre={pp.nombre} /></span>
                            <span>
                              <span className="font-medium text-slate-800">{pp.nombre}</span>
                              <span className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${rol?.clase || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                  {textoRol(pp.rol)}
                                </span>
                                {!pp.activo && <span className="text-[10px] text-slate-400">inactivo</span>}
                                {pp.trabajandoAhora && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                                    <LogIn className="w-3 h-3" /> trabajando
                                  </span>
                                )}
                                {/* En el celular, los días sin salida van acá (la columna no entra) */}
                                {incompletos && <span className="sm:hidden">{incompletos}</span>}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-right font-semibold text-slate-700 tabular-nums">{pp.diasTrabajados}</td>
                        <td className="px-2 sm:px-4 py-3 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">{duracion(pp.minutos)}</td>
                        <td className="hidden sm:table-cell px-4 py-3 text-right">
                          {incompletos || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-right">
                          <button type="button" title={`Cargar un turno de ${pp.nombre}`}
                            onClick={() => setCargandoTurno({ idUsuario: pp.idUsuario, dia: incluyeHoy ? hoy : p.hasta })}
                            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200">
                            <Plus className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {abiertaFila && (
                        <tr className="bg-slate-50/40">
                          <td colSpan={5} className="p-0">
                            <DetallePersona persona={pp} onTurno={setEditando} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              {personas.length > 1 && (
                <tfoot className="bg-slate-50 border-t border-slate-200 text-sm">
                  <tr>
                    <td className="px-3 sm:px-6 py-3 font-semibold text-slate-600">Total del equipo</td>
                    <td className="px-2 sm:px-4 py-3 text-right font-semibold text-slate-700 tabular-nums">{totales.diasTrabajados}</td>
                    <td className="px-2 sm:px-4 py-3 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">{duracion(totales.minutos)}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-right font-semibold text-slate-600">{totales.turnosSinSalida || '—'}</td>
                    <td className="hidden sm:table-cell" />
                  </tr>
                </tfoot>
              )}
            </table>
            {!hayTurnos && (
              <p className="px-6 py-4 text-sm text-slate-500 border-t border-slate-100">
                Nadie del equipo marcó entrada en este período.
              </p>
            )}
          </div>
        )}
      </section>

      {editando && (
        <TurnoModal turno={editando} onClose={() => setEditando(null)} onGuardado={guardado} />
      )}
      {cargandoTurno && (
        <TurnoModal equipo={datos?.equipo || []} inicial={cargandoTurno} onClose={() => setCargandoTurno(null)} onGuardado={guardado} />
      )}
    </div>
  );
};

export default AjustesAsistencia;
