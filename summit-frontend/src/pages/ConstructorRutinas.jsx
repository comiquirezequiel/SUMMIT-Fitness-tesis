import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, FileText, AlertTriangle, CheckCircle, Save, Plus, Trash2, ArrowUp, ArrowDown, Pencil, ArrowLeft,
  ShieldAlert, Loader2, Dumbbell, CalendarPlus,
} from 'lucide-react';
import Modal from '../components/Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../components/Campo';
import BuscadorSocio from '../components/entrenamiento/BuscadorSocio';
import DetalleRutina from '../components/entrenamiento/DetalleRutina';
import ParametrosEjercicio, {
  PARAMETROS_INICIALES, parametrosDe, validarParametros,
} from '../components/entrenamiento/ParametrosEjercicio';
import { Cargando, ErrorCaja, Aviso, Vacio } from '../components/entrenamiento/Estados';
import {
  useSocios, obtenerJson, enviarJson, cargarCatalogo, cargarPatologias, riesgosLocales, puedeEditarEntrenamiento,
  nombreGrupo, formatKg, formatDescanso, seriesPorReps, DIAS_MAXIMOS,
} from '../components/entrenamiento/comun';
import { formatFecha, usuarioActual } from '../utils/formato';

let ultimaClave = 0;
const nuevaClave = () => `borrador-${++ultimaClave}`;
const diaDe = (item) => item.diaNumero || 1;
const mayorDia = (items) => items.reduce((m, i) => Math.max(m, diaDe(i)), 0);
const CAMPOS_PARAMETROS = ['series', 'repeticiones', 'pesoSugeridoKg', 'descansoSegundos', 'observaciones'];
const botonIcono = 'p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center';
const tarjeta = 'bg-white rounded-2xl p-5 border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]';

/**
 * Constructor de rutinas por días, con el cruce preventivo de patologías (RF-09).
 * - Nueva (?socio=ID o eligiendo el socio): se arma un borrador y se crea todo junto con "Crear rutina".
 * - Edición (?rutina=ID): cada cambio se guarda al momento con PUT / POST / DELETE puntuales.
 * Un socio tiene una sola rutina activa: al crear otra, la anterior pasa a inactiva (se avisa).
 */
const Constructor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const idRutina = params.get('rutina');
  const modoEdicion = Boolean(idRutina);
  const puedeEditar = puedeEditarEntrenamiento(usuarioActual());

  const { socios, cargando: cargandoSocios, error: errorSocios } = useSocios();
  const [catalogo, setCatalogo] = useState({ datos: [], cargando: true, error: '' });
  const [rutina, setRutina] = useState({ datos: null, cargando: modoEdicion, error: '' });

  const [borrador, setBorrador] = useState([]);
  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [cantidadDias, setCantidadDias] = useState(1);
  const [diaActivo, setDiaActivo] = useState(1);

  const [ficha, setFicha] = useState({ estado: 'inicial', patologias: [] });
  const [rutinaVigente, setRutinaVigente] = useState(null);
  const [alta, setAlta] = useState({ idEjercicio: '', ...PARAMETROS_INICIALES });
  const [validacion, setValidacion] = useState({ idEjercicio: '', cargando: false, riesgos: [] });
  const [errorAlta, setErrorAlta] = useState('');
  const [editando, setEditando] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState(() => location.state?.aviso || null);

  // El aviso de "rutina creada" llega una sola vez (no se repite al recargar la página)
  useEffect(() => {
    if (location.state?.aviso) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const idSocio = modoEdicion ? (rutina.datos ? String(rutina.datos.idSocio) : null) : params.get('socio');
  const socio = useMemo(() => {
    if (!idSocio) return null;
    const encontrado = socios.find((s) => String(s.idSocio) === idSocio);
    if (encontrado) return encontrado;
    return rutina.datos ? { idSocio: rutina.datos.idSocio, nombreCompleto: rutina.datos.nombreSocio, estado: 'ACTIVO' } : null;
  }, [idSocio, socios, rutina.datos]);

  // ---- Carga de datos ----

  useEffect(() => {
    if (!puedeEditar) return;
    cargarCatalogo()
      .then((datos) => setCatalogo({ datos, cargando: false, error: '' }))
      .catch((e) => setCatalogo({ datos: [], cargando: false, error: e.message }));
  }, [puedeEditar]);

  const recargarRutina = useCallback(async () => {
    try {
      const datos = await obtenerJson(`/rutinas/${idRutina}`, 'No se pudo cargar la rutina.');
      setRutina({ datos, cargando: false, error: '' });
      return datos;
    } catch (e) {
      setRutina((r) => ({ ...r, cargando: false, error: e.message }));
      return null;
    }
  }, [idRutina]);

  const cargarInicial = useCallback(async () => {
    setRutina((r) => ({ ...r, cargando: true, error: '' }));
    const datos = await recargarRutina();
    if (!datos) return;
    setNombre(datos.nombre);
    setObjetivo(datos.objetivo || '');
    setCantidadDias(Math.max(1, datos.totalDias));
  }, [recargarRutina]);

  useEffect(() => { if (modoEdicion) cargarInicial(); }, [modoEdicion, cargarInicial]);

  // Ficha médica (patologías del certificado vigente)
  useEffect(() => {
    if (!idSocio || !puedeEditar) { setFicha({ estado: 'inicial', patologias: [] }); return undefined; }
    let vigente = true;
    setFicha({ estado: 'cargando', patologias: [] });
    cargarPatologias(idSocio).then((f) => { if (vigente) setFicha(f); });
    return () => { vigente = false; };
  }, [idSocio, puedeEditar]);

  // Rutina activa que la nueva va a reemplazar
  useEffect(() => {
    if (modoEdicion || !idSocio) { setRutinaVigente(null); return undefined; }
    let vigente = true;
    obtenerJson(`/rutinas/socio/${idSocio}`)
      .then((lista) => { if (vigente) setRutinaVigente(lista[0] || null); })
      .catch(() => { if (vigente) setRutinaVigente(null); });
    return () => { vigente = false; };
  }, [modoEdicion, idSocio]);

  // Cruce preventivo del ejercicio elegido (lo resuelve el backend con la ficha médica)
  useEffect(() => {
    if (!alta.idEjercicio || !idSocio || !puedeEditar) { setValidacion({ idEjercicio: '', cargando: false, riesgos: [] }); return undefined; }
    let vigente = true;
    setValidacion({ idEjercicio: alta.idEjercicio, cargando: true, riesgos: [] });
    obtenerJson(`/rutinas/validar-ejercicio?idSocio=${idSocio}&idEjercicio=${alta.idEjercicio}`)
      .then((r) => { if (vigente) setValidacion({ idEjercicio: alta.idEjercicio, cargando: false, riesgos: r.riesgos || [] }); })
      .catch(() => { if (vigente) setValidacion({ idEjercicio: alta.idEjercicio, cargando: false, riesgos: [] }); });
    return () => { vigente = false; };
  }, [alta.idEjercicio, idSocio, puedeEditar]);

  // ---- Derivados ----

  const items = modoEdicion
    ? (rutina.datos?.ejercicios || []).map((e) => ({ ...e, clave: e.idRutinaEjercicio }))
    : borrador;
  const soloLectura = modoEdicion && rutina.datos && !rutina.datos.activa;
  const totalDias = Math.min(DIAS_MAXIMOS, Math.max(cantidadDias, mayorDia(items), 1));
  const dia = Math.min(diaActivo, totalDias);
  const delDia = items.filter((i) => diaDe(i) === dia);
  const diasVacios = Array.from({ length: totalDias }, (_, i) => i + 1).filter((d) => !items.some((i) => diaDe(i) === d));
  const catalogoPorId = useMemo(() => new Map(catalogo.datos.map((e) => [e.idEjercicio, e])), [catalogo.datos]);
  const gruposCatalogo = useMemo(() => {
    const grupos = new Map();
    for (const e of catalogo.datos) {
      const g = e.grupoMuscular || 'OTRO';
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(e);
    }
    return [...grupos.entries()].sort((a, b) => nombreGrupo(a[0]).localeCompare(nombreGrupo(b[0]), 'es'));
  }, [catalogo.datos]);
  const riesgosDe = (idEjercicio) => riesgosLocales(ficha.patologias, catalogoPorId.get(idEjercicio)?.patologiasContraindicadas);
  const riesgosAlta = validacion.idEjercicio === alta.idEjercicio ? validacion.riesgos : [];
  const validando = Boolean(alta.idEjercicio) && (validacion.cargando || validacion.idEjercicio !== alta.idEjercicio);
  const datosCambiaron = modoEdicion && rutina.datos
    && (nombre.trim() !== rutina.datos.nombre || (objetivo.trim() || null) !== (rutina.datos.objetivo || null));
  const socioInactivo = !modoEdicion && socio && socio.estado && socio.estado !== 'ACTIVO';

  // ---- Acciones ----

  // Ejecuta cambios sobre la rutina guardada y la vuelve a leer (el backend reordena días y posiciones)
  const ejecutar = async (operacion, textoExito) => {
    setOcupado(true);
    setAviso(null);
    const error = await operacion();
    await recargarRutina();
    setOcupado(false);
    setAviso(error ? { tipo: 'error', texto: error } : textoExito ? { tipo: 'exito', texto: textoExito } : null);
    return !error;
  };

  const errorDe = (r, porDefecto) => (r.ok ? '' : (r.data?.error || porDefecto));

  const elegirSocio = (s) => {
    if (s === null && borrador.length > 0
      && !window.confirm('Si cambiás de socio se descartan los ejercicios que agregaste (los riesgos dependen de la ficha de cada socio). ¿Continuar?')) {
      return;
    }
    setBorrador([]);
    setCantidadDias(1);
    setDiaActivo(1);
    setAviso(null);
    setErrorAlta('');
    setParams(s ? { socio: String(s.idSocio) } : {});
  };

  const cambiarAlta = (campo, valor) => {
    setErrorAlta('');
    setAlta((a) => ({ ...a, [campo]: valor }));
  };

  const agregar = async (forzar) => {
    setErrorAlta('');
    const ejercicio = catalogoPorId.get(Number(alta.idEjercicio));
    if (!ejercicio) { setErrorAlta('Elegí un ejercicio del catálogo.'); return; }
    const { datos, error } = validarParametros(alta);
    if (error) { setErrorAlta(error); return; }
    if (riesgosAlta.length > 0 && !forzar) return; // se confirma con "Agregar igual"

    if (!modoEdicion) {
      setBorrador((b) => [...b, {
        clave: nuevaClave(), idEjercicio: ejercicio.idEjercicio, nombreEjercicio: ejercicio.nombre,
        grupoMuscular: ejercicio.grupoMuscular, diaNumero: dia, ...datos, forzar, riesgos: riesgosAlta,
      }]);
      setAlta({ idEjercicio: '', ...PARAMETROS_INICIALES });
      return;
    }

    setOcupado(true);
    const r = await enviarJson(`/rutinas/${idRutina}/ejercicios?forzar=${forzar}`, 'POST',
      { idEjercicio: ejercicio.idEjercicio, diaNumero: dia, ...datos });
    if (!r.ok) {
      setOcupado(false);
      if (r.data?.riesgos?.length) setValidacion({ idEjercicio: alta.idEjercicio, cargando: false, riesgos: r.data.riesgos });
      setErrorAlta(r.data?.error || 'No se pudo agregar el ejercicio.');
      return;
    }
    setAlta({ idEjercicio: '', ...PARAMETROS_INICIALES });
    await recargarRutina();
    setOcupado(false);
    setAviso({ tipo: 'exito', texto: `${ejercicio.nombre} agregado al Día ${dia}${forzar ? ' (riesgo asumido)' : ''}.` });
  };

  const mover = async (item, delta) => {
    const indice = delDia.findIndex((i) => i.clave === item.clave);
    const destino = indice + delta;
    if (destino < 0 || destino >= delDia.length) return;
    if (!modoEdicion) {
      const otro = delDia[destino].clave;
      setBorrador((b) => {
        const lista = [...b];
        const a = lista.findIndex((i) => i.clave === item.clave);
        const c = lista.findIndex((i) => i.clave === otro);
        [lista[a], lista[c]] = [lista[c], lista[a]];
        return lista;
      });
      return;
    }
    await ejecutar(async () => errorDe(
      await enviarJson(`/rutinas/${idRutina}/ejercicios/${item.idRutinaEjercicio}`, 'PUT', { orden: destino + 1 }),
      'No se pudo mover el ejercicio.',
    ));
  };

  const quitar = async (item) => {
    if (!modoEdicion) { setBorrador((b) => b.filter((i) => i.clave !== item.clave)); return; }
    if (!window.confirm(`¿Quitar "${item.nombreEjercicio}" de la rutina?\n\nLo que el socio ya registró de este ejercicio queda en su historial.`)) return;
    await ejecutar(async () => errorDe(
      await enviarJson(`/rutinas/${idRutina}/ejercicios/${item.idRutinaEjercicio}`, 'DELETE'),
      'No se pudo quitar el ejercicio.',
    ), `${item.nombreEjercicio} quitado de la rutina.`);
  };

  const agregarDia = () => {
    if (totalDias >= DIAS_MAXIMOS) return;
    setCantidadDias(totalDias + 1);
    setDiaActivo(totalDias + 1);
  };

  const quitarDia = async () => {
    if (totalDias <= 1) return;
    const d = dia;
    const delDiaQuitado = items.filter((i) => diaDe(i) === d);
    const posteriores = items.filter((i) => diaDe(i) > d); // ya vienen por día y orden
    if (delDiaQuitado.length > 0 || posteriores.length > 0) {
      const texto = delDiaQuitado.length > 0
        ? `¿Quitar el Día ${d} y sus ${delDiaQuitado.length} ${delDiaQuitado.length === 1 ? 'ejercicio' : 'ejercicios'}?`
        : `¿Quitar el Día ${d}?`;
      if (!window.confirm(`${texto}${posteriores.length > 0 ? '\n\nLos días siguientes se corren un lugar.' : ''}`)) return;
    }
    const nuevoTotal = totalDias - 1;
    if (modoEdicion) {
      await ejecutar(async () => {
        for (const i of delDiaQuitado) {
          const error = errorDe(await enviarJson(`/rutinas/${idRutina}/ejercicios/${i.idRutinaEjercicio}`, 'DELETE'), 'No se pudo quitar un ejercicio del día.');
          if (error) return error;
        }
        for (const i of posteriores) {
          const error = errorDe(await enviarJson(`/rutinas/${idRutina}/ejercicios/${i.idRutinaEjercicio}`, 'PUT', { diaNumero: diaDe(i) - 1 }),
            'No se pudo correr un ejercicio de día.');
          if (error) return error;
        }
        return '';
      }, `Día ${d} quitado.`);
    } else {
      setBorrador((b) => b.filter((i) => diaDe(i) !== d).map((i) => (diaDe(i) > d ? { ...i, diaNumero: diaDe(i) - 1 } : i)));
    }
    setCantidadDias(nuevoTotal);
    setDiaActivo(Math.min(d, nuevoTotal));
  };

  const abrirEdicion = (item) => setEditando({ item, valores: { ...parametrosDe(item), diaNumero: String(diaDe(item)) }, error: '', guardando: false });

  const guardarEdicion = async () => {
    const { item, valores } = editando;
    const { datos, error } = validarParametros(valores);
    if (error) { setEditando((e) => ({ ...e, error })); return; }
    const nuevoDia = Number(valores.diaNumero);

    if (!modoEdicion) {
      setBorrador((b) => {
        const actualizado = { ...item, ...datos, diaNumero: nuevoDia };
        if (nuevoDia === diaDe(item)) return b.map((i) => (i.clave === item.clave ? actualizado : i));
        return [...b.filter((i) => i.clave !== item.clave), actualizado]; // al final del otro día
      });
      if (nuevoDia > totalDias) setCantidadDias(nuevoDia);
      setEditando(null);
      return;
    }

    const cambios = {};
    for (const campo of CAMPOS_PARAMETROS) {
      if ((datos[campo] ?? null) !== (item[campo] ?? null)) cambios[campo] = datos[campo];
    }
    if (nuevoDia !== diaDe(item)) cambios.diaNumero = nuevoDia;
    if (Object.keys(cambios).length === 0) { setEditando(null); return; }
    setEditando((e) => ({ ...e, guardando: true, error: '' }));
    const r = await enviarJson(`/rutinas/${idRutina}/ejercicios/${item.idRutinaEjercicio}`, 'PUT', cambios);
    if (!r.ok) { setEditando((e) => ({ ...e, guardando: false, error: r.data?.error || 'No se pudieron guardar los cambios.' })); return; }
    setEditando(null);
    if (nuevoDia > totalDias) setCantidadDias(nuevoDia);
    await recargarRutina();
    setAviso({ tipo: 'exito', texto: `${item.nombreEjercicio} actualizado${cambios.diaNumero ? ` y movido al Día ${nuevoDia}` : ''}.` });
  };

  const guardarDatos = async () => {
    if (!nombre.trim()) { setAviso({ tipo: 'error', texto: 'Indicá el nombre de la rutina.' }); return; }
    const cambios = {};
    if (nombre.trim() !== rutina.datos.nombre) cambios.nombre = nombre.trim();
    if ((objetivo.trim() || null) !== (rutina.datos.objetivo || null)) cambios.objetivo = objetivo.trim() || null;
    const ok = await ejecutar(async () => errorDe(await enviarJson(`/rutinas/${idRutina}`, 'PUT', cambios),
      'No se pudieron guardar el nombre y el objetivo.'), 'Nombre y objetivo guardados.');
    if (ok) { setNombre(nombre.trim()); setObjetivo(objetivo.trim()); }
  };

  const crear = async () => {
    setAviso(null);
    if (!socio) { setAviso({ tipo: 'error', texto: 'Elegí el socio.' }); return; }
    if (!nombre.trim()) { setAviso({ tipo: 'error', texto: 'Indicá el nombre de la rutina.' }); return; }
    if (borrador.length === 0) { setAviso({ tipo: 'error', texto: 'Agregá al menos un ejercicio.' }); return; }
    if (rutinaVigente && !window.confirm(`${socio.nombreCompleto} ya tiene la rutina activa "${rutinaVigente.nombre}".\n\n`
      + 'Al crear esta, aquella pasa a inactiva y queda en el historial con sus entrenamientos. ¿Crear la nueva rutina?')) return;

    setCreando(true);
    const r = await enviarJson('/rutinas', 'POST', { idSocio: socio.idSocio, nombre: nombre.trim(), objetivo: objetivo.trim() || null });
    if (!r.ok) {
      setCreando(false);
      setAviso({ tipo: 'error', texto: r.data?.error || 'No se pudo crear la rutina.' });
      return;
    }
    const idNueva = r.data.idRutina;
    const rechazados = [];
    const ordenados = [...borrador].sort((a, b) => diaDe(a) - diaDe(b)); // sort estable: respeta el orden dentro del día
    for (const item of ordenados) {
      const { clave, nombreEjercicio, grupoMuscular, forzar, riesgos, ...datos } = item;
      const resp = await enviarJson(`/rutinas/${idNueva}/ejercicios?forzar=${Boolean(forzar)}`, 'POST', datos);
      if (!resp.ok) rechazados.push(`${nombreEjercicio}: ${resp.data?.error || 'error desconocido'}`);
    }
    setCreando(false);
    const reemplazo = rutinaVigente ? ` "${rutinaVigente.nombre}" quedó inactiva.` : '';
    const nuevoAviso = rechazados.length > 0
      ? { tipo: 'error', texto: `Rutina creada, pero no se pudieron agregar: ${rechazados.join(' | ')}.${reemplazo}` }
      : { tipo: 'exito', texto: `Rutina "${nombre.trim()}" creada para ${socio.nombreCompleto} con ${ordenados.length} ejercicios.${reemplazo} Desde acá podés seguir ajustándola: los cambios se guardan al momento.` };
    navigate(`/rutinas/constructor?rutina=${idNueva}`, { replace: true, state: { aviso: nuevoAviso } });
  };

  // ---- Vista ----

  const encabezado = (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">{modoEdicion ? 'Editar rutina' : 'Constructor de rutinas'}</h1>
        <p className="text-sm text-slate-500">
          {modoEdicion
            ? 'Cada cambio se guarda al momento: agregá, mové o quitá ejercicios de cada día.'
            : 'Armá la rutina por días. El cruce con la ficha médica avisa si un ejercicio está contraindicado.'}
        </p>
      </div>
      <button onClick={() => navigate('/entrenamiento/rutinas')} className={`${botonSecundario} whitespace-nowrap bg-white`}>
        <ArrowLeft className="w-4 h-4" /> Ver todas las rutinas
      </button>
    </div>
  );

  if (!puedeEditar) {
    return (
      <div className="space-y-6">
        {encabezado}
        <Aviso tipo="info">Las rutinas las arman y modifican los profesores y los administradores. Desde tu usuario podés consultarlas.</Aviso>
        {modoEdicion && (rutina.cargando ? <Cargando texto="Cargando rutina..." />
          : rutina.error ? <ErrorCaja mensaje={rutina.error} />
            : rutina.datos && (
              <div className={tarjeta}>
                <h2 className="text-lg font-bold text-slate-800">{rutina.datos.nombre}</h2>
                <p className="text-sm text-slate-500 mb-4">{rutina.datos.nombreSocio} · {rutina.datos.objetivo || 'Sin objetivo'}</p>
                <DetalleRutina rutina={rutina.datos} />
              </div>
            ))}
      </div>
    );
  }

  const filaEjercicio = (item, indice) => {
    const riesgos = item.riesgos?.length ? item.riesgos : riesgosDe(item.idEjercicio);
    const descanso = formatDescanso(item.descansoSegundos);
    return (
      <li key={item.clave} className={`p-3 sm:p-4 rounded-xl border ${riesgos.length ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-sm border border-slate-200 shrink-0">
            {indice + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="font-bold text-slate-800">{item.nombreEjercicio}</p>
              {riesgos.length > 0 && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {item.forzar ? 'Riesgo asumido' : 'Contraindicado'}: {riesgos.join(', ')}
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{nombreGrupo(item.grupoMuscular)}</p>
            <p className="text-sm text-slate-600 mt-1">
              <b className="text-slate-800">{seriesPorReps(item.series, item.repeticiones)}</b> · {formatKg(item.pesoSugeridoKg)}
              {descanso && ` · ${descanso} de descanso`}
            </p>
            {item.observaciones && <p className="text-xs text-slate-500 italic mt-0.5">{item.observaciones}</p>}
          </div>
          {!soloLectura && (
            <div className="grid grid-cols-2 sm:flex gap-1 shrink-0">
              <button onClick={() => mover(item, -1)} disabled={indice === 0 || ocupado} className={botonIcono} aria-label={`Subir ${item.nombreEjercicio}`} title="Subir">
                <ArrowUp className="w-4 h-4" />
              </button>
              <button onClick={() => mover(item, 1)} disabled={indice === delDia.length - 1 || ocupado} className={botonIcono} aria-label={`Bajar ${item.nombreEjercicio}`} title="Bajar">
                <ArrowDown className="w-4 h-4" />
              </button>
              <button onClick={() => abrirEdicion(item)} disabled={ocupado} className={botonIcono} aria-label={`Editar ${item.nombreEjercicio}`} title="Editar o mover de día">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => quitar(item)} disabled={ocupado} className={`${botonIcono} hover:!text-rose-600 hover:!bg-rose-50`} aria-label={`Quitar ${item.nombreEjercicio}`} title="Quitar">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </li>
    );
  };

  const opcionesDia = Array.from({ length: Math.min(DIAS_MAXIMOS, totalDias + 1) }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {encabezado}
      {aviso && <Aviso tipo={aviso.tipo} onCerrar={() => setAviso(null)}>{aviso.texto}</Aviso>}

      {modoEdicion && !rutina.datos ? (
        rutina.cargando ? <Cargando texto="Cargando rutina..." />
          : <ErrorCaja mensaje={rutina.error || 'No se encontró la rutina.'} onReintentar={cargarInicial} />
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Socio, ficha médica y rutina vigente */}
          <aside className="w-full lg:w-80 xl:w-96 shrink-0 space-y-4">
            <div className={tarjeta}>
              <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2"><User className="w-5 h-5 text-blue-600" /> Socio</h2>
              {!modoEdicion && idSocio && !socio && cargandoSocios ? <Cargando texto="Cargando socio..." /> : (
                <BuscadorSocio socios={socios} cargando={cargandoSocios} error={errorSocios} seleccionado={socio}
                  onSeleccionar={elegirSocio} permitirCambiar={!modoEdicion && !creando}
                  detalle={(s) => (s.aptoMedicoVigente === undefined ? '' : s.aptoMedicoVigente ? 'Apto vigente' : 'Sin apto vigente')} />
              )}
              {socioInactivo && (
                <Aviso tipo="error" className="mt-3">El socio no está activo: no se le puede crear una rutina.</Aviso>
              )}
            </div>

            <div className={`${tarjeta} ${socio ? '' : 'opacity-60'}`}>
              <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2"><FileText className="w-5 h-5 text-rose-500" /> Ficha médica</h2>
              {!socio ? (
                <p className="text-sm text-slate-400">Elegí un socio para ver sus patologías.</p>
              ) : ficha.estado === 'cargando' || ficha.estado === 'inicial' ? (
                <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando ficha...</p>
              ) : ficha.estado === 'error' ? (
                <p className="text-sm text-rose-600">{ficha.error}</p>
              ) : ficha.estado === 'sin-certificado' ? (
                <Aviso tipo="alerta">No tiene certificado médico cargado: el cruce preventivo no puede detectar contraindicaciones.</Aviso>
              ) : ficha.patologias.length > 0 ? (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Patologías / observaciones</p>
                  <div className="flex flex-wrap gap-2">
                    {ficha.patologias.map((p) => (
                      <span key={p} className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg border border-rose-200">{p.toUpperCase()}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-3">Los ejercicios contraindicados se marcan con ⚠ y piden confirmación para agregarlos.</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-100">
                  <CheckCircle className="w-4 h-4" /> Sin patologías declaradas
                </div>
              )}
              {socio?.aptoMedicoVigente === false && <p className="text-xs text-amber-700 mt-3">Atención: el apto médico no está vigente.</p>}
            </div>

            {!modoEdicion && socio && rutinaVigente && (
              <Aviso tipo="alerta">
                <p><b>{socio.nombreCompleto}</b> ya tiene la rutina activa <b>“{rutinaVigente.nombre}”</b> ({rutinaVigente.totalDias} {rutinaVigente.totalDias === 1 ? 'día' : 'días'} · {rutinaVigente.ejercicios.length} ejercicios, desde el {formatFecha(rutinaVigente.fechaCreacion)}).</p>
                <p className="mt-1">Si creás una nueva, esa pasa a <b>inactiva</b> y queda en el historial.</p>
                <button onClick={() => navigate(`/rutinas/constructor?rutina=${rutinaVigente.idRutina}`)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-amber-300 rounded-lg hover:bg-amber-100">
                  <Pencil className="w-3.5 h-3.5" /> Editar la rutina actual
                </button>
              </Aviso>
            )}
            {soloLectura && (
              <Aviso tipo="alerta">
                <p>Esta rutina está <b>inactiva</b> (fue reemplazada o desactivada): se conserva como historial y no se puede modificar.</p>
                <button onClick={() => navigate(`/rutinas/constructor?socio=${rutina.datos.idSocio}`)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-amber-300 rounded-lg hover:bg-amber-100">
                  <Plus className="w-3.5 h-3.5" /> Armar una nueva
                </button>
              </Aviso>
            )}
          </aside>

          {/* Rutina por días */}
          <section className={`flex-1 min-w-0 w-full bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] ${socio ? '' : 'opacity-60'}`}>
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo label="Nombre de la rutina" required>
                  <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100}
                    placeholder="Ej.: Fuerza 3 días" disabled={!socio || soloLectura || ocupado} className={inputClass} />
                </Campo>
                <Campo label="Objetivo">
                  <input type="text" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} maxLength={255}
                    placeholder="Ej.: Hipertrofia" disabled={!socio || soloLectura || ocupado} className={inputClass} />
                </Campo>
              </div>
              {modoEdicion && rutina.datos && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3">
                  <p className="text-xs text-slate-500">
                    Creada el {formatFecha(rutina.datos.fechaCreacion)}{rutina.datos.nombreProfesor ? ` por ${rutina.datos.nombreProfesor}` : ''} ·{' '}
                    <span className={rutina.datos.activa ? 'text-emerald-700 font-semibold' : 'text-slate-500 font-semibold'}>{rutina.datos.activa ? 'Activa' : 'Inactiva'}</span>
                  </p>
                  {datosCambiaron && !soloLectura && (
                    <div className="flex gap-2">
                      <button onClick={() => { setNombre(rutina.datos.nombre); setObjetivo(rutina.datos.objetivo || ''); }} disabled={ocupado} className={botonSecundario}>Descartar</button>
                      <button onClick={guardarDatos} disabled={ocupado} className={botonPrimario}><Save className="w-4 h-4" /> Guardar nombre y objetivo</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pestañas de días */}
            <div className="px-5 pt-4 flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Días de la rutina">
              {Array.from({ length: totalDias }, (_, i) => i + 1).map((d) => {
                const cantidad = items.filter((i) => diaDe(i) === d).length;
                return (
                  <button key={d} role="tab" aria-selected={d === dia} onClick={() => setDiaActivo(d)}
                    className={`px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap border transition-colors flex items-center gap-2 ${d === dia
                      ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    Día {d}
                    <span className={`text-[11px] px-1.5 rounded-full ${d === dia ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{cantidad}</span>
                  </button>
                );
              })}
              {!soloLectura && totalDias < DIAS_MAXIMOS && (
                <button onClick={agregarDia} disabled={!socio || ocupado}
                  className="px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50">
                  <CalendarPlus className="w-4 h-4" /> Agregar día
                </button>
              )}
              {!soloLectura && totalDias > 1 && (
                <button onClick={quitarDia} disabled={ocupado}
                  className="ml-auto px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 disabled:opacity-50">
                  <Trash2 className="w-4 h-4" /> Quitar Día {dia}
                </button>
              )}
            </div>

            {/* Ejercicios del día */}
            <div className="p-5 space-y-3">
              {delDia.length === 0 ? (
                <Vacio icono={Dumbbell} titulo={`El Día ${dia} no tiene ejercicios`}>
                  {!soloLectura && (socio ? 'Agregalos con el formulario de abajo.' : 'Primero elegí el socio.')}
                </Vacio>
              ) : (
                <ol className={`space-y-2 ${ocupado ? 'opacity-60' : ''}`}>{delDia.map(filaEjercicio)}</ol>
              )}
              {diasVacios.length > 0 && items.length > 0 && !soloLectura && (
                <p className="text-xs text-amber-700">
                  {diasVacios.length === 1 ? `El Día ${diasVacios[0]} no tiene ejercicios` : `Los días ${diasVacios.join(', ')} no tienen ejercicios`}: completalos o quitalos.
                </p>
              )}
            </div>

            {/* Agregar ejercicio */}
            {!soloLectura && (
              <div className="mx-5 mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-700">Agregar ejercicio al Día {dia}</h3>
                {catalogo.error ? <ErrorCaja mensaje={catalogo.error} /> : (
                  <>
                    <Campo label="Ejercicio" required>
                      <select value={alta.idEjercicio} onChange={(e) => cambiarAlta('idEjercicio', e.target.value)}
                        disabled={!socio || catalogo.cargando || ocupado || socioInactivo} className={inputClass}>
                        <option value="">{catalogo.cargando ? 'Cargando catálogo...' : 'Elegí un ejercicio del catálogo...'}</option>
                        {gruposCatalogo.map(([grupo, ejercicios]) => (
                          <optgroup key={grupo} label={nombreGrupo(grupo)}>
                            {ejercicios.map((e) => (
                              <option key={e.idEjercicio} value={e.idEjercicio}>
                                {e.nombre}{riesgosDe(e.idEjercicio).length > 0 ? ' ⚠ contraindicado' : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </Campo>
                    <ParametrosEjercicio valores={alta} onChange={cambiarAlta} deshabilitado={!socio || ocupado || socioInactivo} />

                    {riesgosAlta.length > 0 && (
                      <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl" role="alert">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0"><AlertTriangle className="w-5 h-5" /></div>
                          <div>
                            <h4 className="font-bold text-amber-900">Riesgo de lesión: ejercicio contraindicado</h4>
                            <p className="text-sm text-amber-800 mt-1">Choca con estas patologías de {socio?.nombreCompleto}:</p>
                            <ul className="list-disc ml-5 mt-1 text-sm font-bold text-rose-700">
                              {riesgosAlta.map((r) => <li key={r}>{r}</li>)}
                            </ul>
                            <p className="text-xs text-amber-800 mt-2">Si igual lo indicás (por ejemplo, adaptado), queda agregado asumiendo el riesgo.</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {errorAlta && <p className="text-sm text-rose-600" role="alert">{errorAlta}</p>}

                    <div className="flex flex-col sm:flex-row justify-end gap-2">
                      {riesgosAlta.length > 0 && (
                        <button onClick={() => cambiarAlta('idEjercicio', '')} disabled={ocupado} className={botonSecundario}>Elegir otro</button>
                      )}
                      {riesgosAlta.length > 0 ? (
                        <button onClick={() => agregar(true)} disabled={ocupado}
                          className="px-4 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg flex items-center justify-center gap-2">
                          <ShieldAlert className="w-4 h-4" /> Agregar igual
                        </button>
                      ) : (
                        <button onClick={() => agregar(false)} disabled={!socio || !alta.idEjercicio || validando || ocupado || socioInactivo} className={botonPrimario}>
                          {validando || ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          {validando ? 'Revisando ficha médica...' : `Agregar al Día ${dia}`}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Pie */}
            <div className="px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {totalDias} {totalDias === 1 ? 'día' : 'días'} · {items.length} {items.length === 1 ? 'ejercicio' : 'ejercicios'}
                {ocupado && <span className="inline-flex items-center gap-1 ml-2 text-blue-600"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</span>}
              </p>
              {modoEdicion ? (
                <button onClick={() => navigate('/entrenamiento/rutinas')} disabled={ocupado} className={botonSecundario}>Listo, volver a Rutinas</button>
              ) : (
                <button onClick={crear} disabled={!socio || creando || borrador.length === 0 || socioInactivo} className={botonPrimario}>
                  {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {creando ? 'Creando rutina...' : 'Crear rutina'}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {editando && (
        <Modal
          titulo={`Editar: ${editando.item.nombreEjercicio}`}
          subtitulo={`${nombreGrupo(editando.item.grupoMuscular)} · Día ${diaDe(editando.item)}`}
          onClose={() => { if (!editando.guardando) setEditando(null); }}
          ancho="max-w-xl"
          pie={(
            <>
              <button onClick={() => setEditando(null)} disabled={editando.guardando} className={botonSecundario}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={editando.guardando} className={botonPrimario}>
                {editando.guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
              </button>
            </>
          )}
        >
          <div className="space-y-3">
            <Campo label="Día" ayuda="Si lo pasás a otro día, queda al final de ese día.">
              <select value={editando.valores.diaNumero} className={inputClass}
                onChange={(e) => setEditando((ed) => ({ ...ed, valores: { ...ed.valores, diaNumero: e.target.value } }))}>
                {opcionesDia.map((d) => <option key={d} value={d}>Día {d}{d > totalDias ? ' (nuevo)' : ''}</option>)}
              </select>
            </Campo>
            <ParametrosEjercicio valores={editando.valores} deshabilitado={editando.guardando}
              onChange={(campo, valor) => setEditando((ed) => ({ ...ed, error: '', valores: { ...ed.valores, [campo]: valor } }))} />
            {editando.error && <p className="text-sm text-rose-600" role="alert">{editando.error}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
};

// Pasar de una rutina a otra (o a una nueva) arranca el constructor de cero
const ConstructorRutinas = () => {
  const [params] = useSearchParams();
  return <Constructor key={params.get('rutina') || 'nueva'} />;
};

export default ConstructorRutinas;
