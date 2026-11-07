import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  User, FileText, AlertTriangle, CheckCircle, CheckCircle2, Save, Plus, Trash2, ArrowUp, ArrowDown, Pencil, LayoutTemplate,
  ShieldAlert, Loader2, Dumbbell, CalendarPlus, Sparkles,
} from 'lucide-react';
import SugerenciasEjercicios from '../components/ia/SugerenciasEjercicios';
import Modal from '../components/Modal';
import Campo, { inputClass, botonPrimario, botonSecundario, selectorHerramienta } from '../components/Campo';
import BuscadorSocio from '../components/entrenamiento/BuscadorSocio';
import DetalleRutina from '../components/entrenamiento/DetalleRutina';
import ParametrosEjercicio, {
  PARAMETROS_INICIALES, parametrosDe, validarParametros,
} from '../components/entrenamiento/ParametrosEjercicio';
import SelectorEjercicio, {
  MiniaturaGif, VistaPreviaGif, calcularPosicionHover,
} from '../components/entrenamiento/SelectorEjercicio';
import { Cargando, ErrorCaja, Aviso, Vacio } from '../components/entrenamiento/Estados';
import BotonesPdf from '../components/pdf/BotonesPdf';
import { documentoRutina } from '../components/pdf/rutina';
import { PLANTILLAS, plantillaPorId, resumenPlantilla, armarDesdePlantilla } from '../components/entrenamiento/plantillas';
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
// tactil: (tailwind.config.js) en el celular y la tablet los botones van de 44 px o más
const botonIcono = 'w-8 h-8 tactil:w-11 tactil:h-11 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center';
const botonChico = 'px-3 py-1.5 tactil:min-h-11 tactil:px-4 text-xs tactil:text-sm font-semibold';
const tarjeta = 'bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]';

/**
 * Constructor de rutinas por días, con el cruce preventivo de patologías (RF-09). Ya no es una pantalla fija: se abre
 * en una ventana sobre Rutinas con "+ Nueva rutina", "Editar" o una rutina predeterminada, y la dirección dice qué
 * hay abierto (así "Atrás" la cierra y un link la vuelve a abrir):
 * - Nueva (?nueva=1, con ?socio=ID o eligiendo el socio, y ?plantilla=ID para partir de una rutina predeterminada):
 *   se arma un borrador y se crea todo junto con "Crear rutina".
 * - Edición (?rutina=ID): cada cambio se guarda al momento con PUT / POST / DELETE puntuales.
 * Un socio tiene una sola rutina activa: al crear otra, la anterior pasa a inactiva (se avisa).
 */
const Constructor = ({ onCerrar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
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
  // Ejercicios que conviene evitar según el asistente de IA: idEjercicio -> { motivo, origen }
  // Lo completa el panel SugerenciasEjercicios. Es un Map para buscar rápido por id al dibujar el desplegable.
  // Importante: estas marcas NO bloquean; lo que bloquea (con "Agregar igual") sigue siendo la regla firme (riesgosDe).
  const [sugerenciasIa, setSugerenciasIa] = useState(() => new Map());
  const [rutinaVigente, setRutinaVigente] = useState(null);
  const [alta, setAlta] = useState({ idEjercicio: '', ...PARAMETROS_INICIALES });
  const [validacion, setValidacion] = useState({ idEjercicio: '', cargando: false, riesgos: [] });
  const [errorAlta, setErrorAlta] = useState('');
  // Confirmación al lado del formulario: en el celular, el aviso de arriba queda fuera de la vista
  const [ultimoAgregado, setUltimoAgregado] = useState(null);
  const [editando, setEditando] = useState(null);
  const [hoverFila, setHoverFila] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState(() => location.state?.aviso || null);
  // Rutina predeterminada elegida en Rutinas: se carga sola apenas estén el socio, el catálogo y la ficha médica
  const [plantillaPendiente, setPlantillaPendiente] = useState(() => (modoEdicion ? null : plantillaPorId(params.get('plantilla'))));

  // Cambia lo que muestra la ventana sin sumar pasos al "Atrás" del navegador (que la cierra y vuelve a la lista).
  // desdeLista: la ventana se abrió desde Rutinas (al cerrarla se vuelve un paso atrás en lugar de sumar otro)
  const irA = (busqueda, extra = {}) => navigate({ pathname: location.pathname, search: `?${new URLSearchParams(busqueda)}` },
    { replace: true, state: { desdeLista: location.state?.desdeLista, ...extra } });

  // El aviso de "rutina creada" llega una sola vez (no se repite al recargar la página)
  useEffect(() => {
    if (location.state?.aviso) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: { desdeLista: location.state.desdeLista } });
    }
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
    if (Number(alta.idEjercicio) < 0) {
      setValidacion({ idEjercicio: alta.idEjercicio, cargando: false, riesgos: riesgosLocales(ficha.patologias, catalogoPorId.get(Number(alta.idEjercicio))?.patologiasContraindicadas) });
      return undefined;
    }
    setValidacion({ idEjercicio: alta.idEjercicio, cargando: true, riesgos: [] });
    obtenerJson(`/rutinas/validar-ejercicio?idSocio=${idSocio}&idEjercicio=${alta.idEjercicio}`)
      .then((r) => { if (vigente) setValidacion({ idEjercicio: alta.idEjercicio, cargando: false, riesgos: r.riesgos || [] }); })
      .catch(() => { if (vigente) setValidacion({ idEjercicio: alta.idEjercicio, cargando: false, riesgos: [] }); });
    return () => { vigente = false; };
  }, [alta.idEjercicio, idSocio, puedeEditar, ficha.patologias, catalogoPorId]);

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
  const riesgosDe = (idEjercicio) => riesgosLocales(ficha.patologias, catalogoPorId.get(idEjercicio)?.patologiasContraindicadas);
  // Marca de cada ejercicio en el buscador: ⚠ regla firme (bloquea y pide confirmación) o ✦ solo lo sugiere la IA
  // (informativo). Si tiene las dos, se muestra ⚠ porque es la que manda.
  const marcaDe = (e) => {
    const riesgos = riesgosDe(e.idEjercicio);
    if (riesgos.length > 0) return { tipo: 'riesgo', texto: `Contraindicado: ${riesgos.join(', ')}` };
    return sugerenciasIa.has(e.idEjercicio) ? { tipo: 'ia', texto: 'La IA sugiere evitarlo' } : null;
  };
  const riesgosAlta = validacion.idEjercicio === alta.idEjercicio ? validacion.riesgos : [];
  const validando = Boolean(alta.idEjercicio) && (validacion.cargando || validacion.idEjercicio !== alta.idEjercicio);
  const datosCambiaron = modoEdicion && rutina.datos
    && (nombre.trim() !== rutina.datos.nombre || (objetivo.trim() || null) !== (rutina.datos.objetivo || null));
  const socioInactivo = !modoEdicion && socio && socio.estado && socio.estado !== 'ACTIVO';
  // PDF de la rutina guardada: se vuelve a armar cada vez que cambia (cada cambio la relee del backend)
  const documentoPdf = useMemo(
    () => (rutina.datos ? documentoRutina(rutina.datos, { objetivoSocio: socio?.objetivo }) : null),
    [rutina.datos, socio?.objetivo],
  );

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
    setUltimoAgregado(null);
    irA({ nueva: '1', ...(s ? { socio: String(s.idSocio) } : {}) });
  };

  const cambiarAlta = (campo, valor) => {
    setErrorAlta('');
    if (campo === 'idEjercicio') setUltimoAgregado(null);
    setAlta((a) => ({ ...a, [campo]: valor }));
  };

  // Después de agregar: series, repeticiones y descanso quedan para el próximo (suelen repetirse); carga y notas no
  const limpiarAlta = () => setAlta((a) => ({ ...a, idEjercicio: '', pesoSugeridoKg: '', observaciones: '' }));

  const agregar = async (forzar) => {
    setErrorAlta('');
    const ejercicio = catalogoPorId.get(Number(alta.idEjercicio));
    if (!ejercicio) { setErrorAlta('Elegí un ejercicio del catálogo.'); return; }
    const { datos, error } = validarParametros(alta);
    if (error) { setErrorAlta(error); return; }
    if (riesgosAlta.length > 0 && !forzar) return; // se confirma con "Agregar igual"

    const agregado = { nombre: ejercicio.nombre, detalle: `${seriesPorReps(datos.series, datos.repeticiones)} · ${formatKg(datos.pesoSugeridoKg)}`, dia };
    if (!modoEdicion) {
      setBorrador((b) => [...b, {
        clave: nuevaClave(), idEjercicio: ejercicio.idEjercicio, nombreEjercicio: ejercicio.nombre,
        grupoMuscular: ejercicio.grupoMuscular, urlMedia: ejercicio.urlMedia, diaNumero: dia, ...datos, forzar, riesgos: riesgosAlta,
      }]);
      limpiarAlta();
      setUltimoAgregado(agregado);
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
    limpiarAlta();
    await recargarRutina();
    setOcupado(false);
    setUltimoAgregado(agregado);
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
    if (!window.confirm(`¿Quitar "${item.nombreEjercicio}" de la rutina?`)) return;
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
      + 'Al crear esta, aquella pasa a inactiva (queda guardada). ¿Crear la nueva rutina?')) return;

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
      const { clave, nombreEjercicio, grupoMuscular, urlMedia, forzar, riesgos, ...datos } = item;
      const resp = await enviarJson(`/rutinas/${idNueva}/ejercicios?forzar=${Boolean(forzar)}`, 'POST', datos);
      if (!resp.ok) rechazados.push(`${nombreEjercicio}: ${resp.data?.error || 'error desconocido'}`);
    }
    setCreando(false);
    const reemplazo = rutinaVigente ? ` "${rutinaVigente.nombre}" quedó inactiva.` : '';
    const nuevoAviso = rechazados.length > 0
      ? { tipo: 'error', texto: `Rutina creada, pero no se pudieron agregar: ${rechazados.join(' | ')}.${reemplazo}` }
      : { tipo: 'exito', texto: `Rutina "${nombre.trim()}" creada para ${socio.nombreCompleto} con ${ordenados.length} ejercicios.${reemplazo} Ya podés imprimirla o mandársela en PDF, y seguir ajustándola desde acá: los cambios se guardan al momento.` };
    irA({ rutina: String(idNueva) }, { aviso: nuevoAviso });
  };

  // Rutina predeterminada -> borrador (reemplaza lo que había, preguntando). El nombre y el objetivo se completan si
  // estaban vacíos. Los contraindicados para este socio quedan marcados con ⚠: al crear no se agregan sin confirmar.
  const cargarPlantilla = (plantilla) => {
    if (!plantilla) return;
    if (borrador.length > 0
      && !window.confirm(`¿Reemplazar los ${borrador.length} ejercicios del borrador por la rutina "${plantilla.nombre}"?`)) return;
    const { items: nuevos, faltantes } = armarDesdePlantilla(plantilla, catalogo.datos);
    setBorrador(nuevos.map((i) => ({ ...i, clave: nuevaClave(), forzar: false, riesgos: [] })));
    setCantidadDias(Math.min(DIAS_MAXIMOS, plantilla.dias.length));
    setDiaActivo(1);
    setNombre((n) => n.trim() || plantilla.nombre);
    setObjetivo((o) => o.trim() || plantilla.objetivo);
    setUltimoAgregado(null);
    setErrorAlta('');
    const riesgosos = nuevos.filter((i) => riesgosDe(i.idEjercicio).length > 0).length;
    const partes = [`Rutina predeterminada "${plantilla.nombre}" cargada: ${nuevos.length} ejercicios en ${plantilla.dias.length} días. Ajustala si hace falta y tocá "Crear rutina".`];
    if (faltantes.length) partes.push(`El catálogo no tiene: ${faltantes.join(', ')}.`);
    if (riesgosos) {
      partes.push(`${riesgosos} ${riesgosos === 1 ? 'ejercicio queda marcado' : 'ejercicios quedan marcados'} con ⚠ por la ficha médica: cambialos o quitalos (al crear no se agregan).`);
    }
    setAviso({ tipo: riesgosos || faltantes.length ? 'alerta' : 'exito', texto: partes.join(' ') });
  };

  const fichaLista = ficha.estado !== 'inicial' && ficha.estado !== 'cargando';
  useEffect(() => {
    if (!plantillaPendiente || !socio || catalogo.cargando || !fichaLista) return;
    setPlantillaPendiente(null);
    cargarPlantilla(plantillaPendiente);
  }, [plantillaPendiente, socio, catalogo.cargando, fichaLista]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar la ventana: con un borrador sin crear se pregunta (se perdería); en la edición ya está todo guardado
  const cerrar = () => {
    if (creando || ocupado) return;
    if (!modoEdicion && borrador.length > 0
      && !window.confirm('La rutina todavía no se creó: si cerrás, se pierden los ejercicios que agregaste. ¿Cerrar igual?')) return;
    onCerrar();
  };

  // ---- Vista ----

  // La rutina guardada se imprime o se le manda al socio en PDF (en el celular, por WhatsApp con Compartir)
  const barraPdf = documentoPdf && (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex flex-col lg:flex-row lg:items-center gap-2">
      <div className="flex items-center gap-2 lg:flex-1 min-w-0">
        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
        <p className="text-xs text-slate-600"><b className="text-slate-800">Rutina en PDF</b> para imprimir o mandarle al socio</p>
      </div>
      <BotonesPdf documento={documentoPdf} className="lg:shrink-0" />
    </div>
  );

  // Ventana grande (alto fijo: no salta mientras carga) con la lista de Rutinas detrás
  const ventana = (contenido) => (
    <Modal ancho="max-w-6xl" alto="h-[92dvh]" onClose={cerrar}
      titulo={modoEdicion ? `Editar rutina${rutina.datos ? `: ${rutina.datos.nombre}` : ''}` : 'Nueva rutina'}
      subtitulo={modoEdicion
        ? 'Cada cambio se guarda al momento: agregá, mové o quitá ejercicios de cada día.'
        : 'Armá la rutina por días o partí de una rutina predeterminada. El cruce con la ficha médica avisa si un ejercicio está contraindicado.'}>
      <div className="space-y-3">{contenido}</div>
    </Modal>
  );

  if (!puedeEditar) {
    return ventana(
      <>
        {barraPdf}
        <Aviso tipo="info">Las rutinas las arman y modifican los profesores y los administradores. Desde tu usuario podés consultarlas.</Aviso>
        {modoEdicion && (rutina.cargando ? <Cargando texto="Cargando rutina..." />
          : rutina.error ? <ErrorCaja mensaje={rutina.error} />
            : rutina.datos && (
              <div className={tarjeta}>
                <h2 className="text-base font-bold text-slate-800">{rutina.datos.nombre}</h2>
                <p className="text-sm text-slate-500 mb-3">{rutina.datos.nombreSocio} · {rutina.datos.objetivo || 'Sin objetivo'}</p>
                <DetalleRutina rutina={rutina.datos} />
              </div>
            ))}
      </>,
    );
  }

  const filaEjercicio = (item, indice) => {
    const riesgos = item.riesgos?.length ? item.riesgos : riesgosDe(item.idEjercicio);
    const descanso = formatDescanso(item.descansoSegundos);
    const ejercicioVisual = {
      idEjercicio: item.idEjercicio,
      nombre: item.nombreEjercicio,
      grupoMuscular: item.grupoMuscular,
      urlMedia: item.urlMedia || catalogoPorId.get(item.idEjercicio)?.urlMedia,
    };
    const actualizarHoverFila = (e) => {
      const { x, y } = calcularPosicionHover(e.clientX, e.clientY);
      setHoverFila({ ejercicio: ejercicioVisual, x, y });
    };
    return (
      <li
        key={item.clave}
        onMouseEnter={actualizarHoverFila}
        onMouseOver={actualizarHoverFila}
        onMouseMove={actualizarHoverFila}
        onMouseLeave={() => setHoverFila(null)}
        className={`p-3 sm:p-3 rounded-xl border ${riesgos.length ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-200 shadow-xs'}`}
      >
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-sm border border-slate-200 shrink-0">
            {indice + 1}
          </span>
          <MiniaturaGif ejercicio={ejercicioVisual} tamano="w-11 h-11" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="font-bold text-slate-800 leading-snug">{item.nombreEjercicio}</p>
              {riesgos.length > 0 && (
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {item.forzar ? 'Riesgo asumido' : 'Contraindicado'}: {riesgos.join(', ')}
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{nombreGrupo(item.grupoMuscular)}</p>
            <p className="text-sm text-slate-600 mt-1">
              <b className="text-slate-800">{seriesPorReps(item.series, item.repeticiones)}</b> · {formatKg(item.pesoSugeridoKg)}
              {descanso && ` · ${descanso} de descanso`}
            </p>
            {item.observaciones && <p className="text-xs text-slate-500 italic mt-0.5">{item.observaciones}</p>}
          </div>
          {/* Desde la tablet, los botones al costado (de a dos hasta que hay lugar para los cuatro en fila) */}
          {!soloLectura && <div className="hidden sm:grid grid-cols-2 lg:flex gap-1.5 shrink-0">{accionesFila(item, indice)}</div>}
        </div>
        {/* En el celular, abajo y separados, para no tocar uno por otro */}
        {!soloLectura && <div className="sm:hidden flex items-center gap-2 mt-2 pt-3 border-t border-slate-100">{accionesFila(item, indice, true)}</div>}
      </li>
    );
  };

  const accionesFila = (item, indice, conTexto = false) => (
    <>
      <button onClick={() => mover(item, -1)} disabled={indice === 0 || ocupado} className={botonIcono} aria-label={`Subir ${item.nombreEjercicio}`} title="Subir">
        <ArrowUp className="w-4 h-4" />
      </button>
      <button onClick={() => mover(item, 1)} disabled={indice === delDia.length - 1 || ocupado} className={botonIcono} aria-label={`Bajar ${item.nombreEjercicio}`} title="Bajar">
        <ArrowDown className="w-4 h-4" />
      </button>
      <button onClick={() => abrirEdicion(item)} disabled={ocupado} aria-label={`Editar ${item.nombreEjercicio}`} title="Editar o mover de día"
        className={conTexto ? `${botonIcono} w-auto! px-3 gap-2 ml-auto text-sm font-semibold text-slate-700` : botonIcono}>
        <Pencil className="w-4 h-4" />{conTexto && 'Editar'}
      </button>
      <button onClick={() => quitar(item)} disabled={ocupado} className={`${botonIcono} hover:text-rose-700! hover:bg-rose-50!`} aria-label={`Quitar ${item.nombreEjercicio}`} title="Quitar">
        <Trash2 className="w-4 h-4" />
      </button>
    </>
  );

  const opcionesDia = Array.from({ length: Math.min(DIAS_MAXIMOS, totalDias + 1) }, (_, i) => i + 1);

  return ventana(
    <>
      {barraPdf}
      {aviso && <Aviso tipo={aviso.tipo} onCerrar={() => setAviso(null)}>{aviso.texto}</Aviso>}

      {modoEdicion && !rutina.datos ? (
        rutina.cargando ? <Cargando texto="Cargando rutina..." />
          : <ErrorCaja mensaje={rutina.error || 'No se encontró la rutina.'} onReintentar={cargarInicial} />
      ) : (
        // Dos columnas recién desde 1280 px: con el menú lateral, una tablet acostada deja unos 720 px y la rutina
        // quedaría angosta. Hasta ahí, socio y ficha van arriba, de a dos tarjetas cuando entran.
        <div className="flex flex-col xl:flex-row gap-3 sm:gap-4 items-start">
          {/* Socio, ficha médica y rutina vigente */}
          <aside className="w-full xl:w-80 2xl:w-96 shrink-0 grid gap-3 items-start grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] xl:grid-cols-1">
            <div className={tarjeta}>
              <h2 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2"><User className="w-5 h-5 text-blue-600" /> Socio</h2>
              {!modoEdicion && idSocio && !socio && cargandoSocios ? <Cargando texto="Cargando socio..." /> : (
                <BuscadorSocio socios={socios} cargando={cargandoSocios} error={errorSocios} seleccionado={socio}
                  onSeleccionar={elegirSocio} permitirCambiar={!modoEdicion && !creando}
                  detalle={(s) => (s.aptoMedicoVigente === undefined ? '' : s.aptoMedicoVigente ? 'Apto vigente' : 'Sin apto vigente')} />
              )}
              {socioInactivo && (
                <Aviso tipo="error" className="mt-2">El socio no está activo: no se le puede crear una rutina.</Aviso>
              )}
            </div>

            <div className={tarjeta}>
              <h2 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2"><FileText className="w-5 h-5 text-rose-500" /> Ficha médica</h2>
              {!socio ? (
                <p className="text-sm text-slate-500">Elegí un socio para ver sus patologías.</p>
              ) : ficha.estado === 'cargando' || ficha.estado === 'inicial' ? (
                <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando ficha...</p>
              ) : ficha.estado === 'error' ? (
                <p className="text-sm text-rose-700">{ficha.error}</p>
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
                  <p className="text-xs text-slate-500 mt-2">Los ejercicios contraindicados se marcan con ⚠ y piden confirmación para agregarlos.</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-medium border border-emerald-100">
                  <CheckCircle className="w-4 h-4" /> Sin patologías declaradas
                </div>
              )}
              {ficha.estado === 'ok' && ficha.resumenIa && (
                <p className="text-sm text-slate-600 mt-2 flex items-start gap-1.5">
                  <Sparkles className="w-4 h-4 mt-0.5 text-violet-500 shrink-0" /> {ficha.resumenIa}
                </p>
              )}
              {/* El panel de la IA aparece solo para el personal que edita rutinas y si el socio tiene algo que analizar
                  (patologías o resumen): sin patologías no hay ejercicios que evitar. */}
              {socio && puedeEditar && ficha.estado === 'ok' && (ficha.patologias.length > 0 || ficha.resumenIa) && (
                <SugerenciasEjercicios idSocio={idSocio} onSugerencias={setSugerenciasIa} />
              )}
              {socio?.aptoMedicoVigente === false && <p className="text-xs text-amber-700 mt-2">Atención: el apto médico no está vigente.</p>}
            </div>

            {!modoEdicion && socio && rutinaVigente && (
              <Aviso tipo="alerta">
                <p><b>{socio.nombreCompleto}</b> ya tiene la rutina activa <b>“{rutinaVigente.nombre}”</b> ({rutinaVigente.totalDias} {rutinaVigente.totalDias === 1 ? 'día' : 'días'} · {rutinaVigente.ejercicios.length} ejercicios, desde el {formatFecha(rutinaVigente.fechaCreacion)}).</p>
                <p className="mt-1">Si creás una nueva, esa pasa a <b>inactiva</b> y queda guardada.</p>
                <button onClick={() => irA({ rutina: String(rutinaVigente.idRutina) })}
                  className={`mt-2 inline-flex items-center gap-1.5 ${botonChico} bg-white border border-amber-300 rounded-lg hover:bg-amber-100`}>
                  <Pencil className="w-3.5 h-3.5" /> Editar la rutina actual
                </button>
              </Aviso>
            )}
            {soloLectura && (
              <Aviso tipo="alerta">
                <p>Esta rutina está <b>inactiva</b> (fue reemplazada o desactivada): se conserva como historial y no se puede modificar.</p>
                <button onClick={() => irA({ nueva: '1', socio: String(rutina.datos.idSocio) })}
                  className={`mt-2 inline-flex items-center gap-1.5 ${botonChico} bg-white border border-amber-300 rounded-lg hover:bg-amber-100`}>
                  <Plus className="w-3.5 h-3.5" /> Armar una nueva
                </button>
              </Aviso>
            )}
          </aside>

          {/* Rutina por días */}
          <section className={`flex-1 min-w-0 w-full bg-white rounded-xl border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]`}>
            <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
              {!modoEdicion && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <label htmlFor="rutina-predeterminada" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <LayoutTemplate className="w-4 h-4 text-violet-600" /> Partir de una rutina predeterminada
                  </label>
                  <select id="rutina-predeterminada" value="" onChange={(e) => cargarPlantilla(plantillaPorId(e.target.value))}
                    disabled={!socio || ocupado || catalogo.cargando || !fichaLista || socioInactivo}
                    className={`${selectorHerramienta} flex-1 min-w-48`}>
                    <option value="">{plantillaPendiente ? `Se carga "${plantillaPendiente.nombre}" al elegir el socio` : socio ? 'Elegí una plantilla…' : 'Primero elegí el socio'}</option>
                    {PLANTILLAS.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {resumenPlantilla(p)} · {p.nivel}</option>)}
                  </select>
                </div>
              )}
              <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                  <p className="text-xs text-slate-500">
                    Creada el {formatFecha(rutina.datos.fechaCreacion)}{rutina.datos.nombreProfesor ? ` por ${rutina.datos.nombreProfesor}` : ''} ·{' '}
                    <span className={rutina.datos.activa ? 'text-emerald-700 font-semibold' : 'text-slate-500 font-semibold'}>{rutina.datos.activa ? 'Activa' : 'Inactiva'}</span>
                  </p>
                  {datosCambiaron && !soloLectura && (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setNombre(rutina.datos.nombre); setObjetivo(rutina.datos.objetivo || ''); }} disabled={ocupado} className={`${botonSecundario} flex-1 sm:flex-none`}>Descartar</button>
                      <button onClick={guardarDatos} disabled={ocupado} className={`${botonPrimario} flex-1 sm:flex-none`}><Save className="w-4 h-4" /> Guardar nombre y objetivo</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pestañas de días: en pantallas chicas se deslizan de costado */}
            <div className="px-3 sm:px-4 pt-3 flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar" role="tablist" aria-label="Días de la rutina">
              {Array.from({ length: totalDias }, (_, i) => i + 1).map((d) => {
                const cantidad = items.filter((i) => diaDe(i) === d).length;
                return (
                  <button key={d} role="tab" aria-selected={d === dia} onClick={() => setDiaActivo(d)}
                    className={`px-3.5 py-1.5 tactil:min-h-11 tactil:px-4 rounded-lg text-sm font-semibold whitespace-nowrap border transition-colors flex items-center gap-2 shrink-0 ${d === dia
                      ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    Día {d}
                    <span className={`text-xs px-1.5 rounded-full ${d === dia ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>{cantidad}</span>
                  </button>
                );
              })}
              {!soloLectura && totalDias < DIAS_MAXIMOS && (
                <button onClick={agregarDia} disabled={!socio || ocupado}
                  className="px-3 py-1.5 tactil:min-h-11 tactil:px-4 rounded-lg text-sm font-semibold whitespace-nowrap border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                  <CalendarPlus className="w-4 h-4" /> Agregar día
                </button>
              )}
            </div>

            {/* Ejercicios del día */}
            <div className="p-3 sm:p-4 space-y-3">
              {/* Quitar el día va acá, a la vista, y no al final de las pestañas (en el celular quedaría fuera de la pantalla) */}
              <div className="flex items-center justify-between gap-3 min-h-11">
                <h3 className="font-bold text-slate-800">
                  Día {dia} <span className="font-medium text-slate-500 text-sm">· {delDia.length} {delDia.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
                </h3>
                {!soloLectura && totalDias > 1 && (
                  <button onClick={quitarDia} disabled={ocupado}
                    className="px-3 py-1.5 tactil:min-h-11 rounded-lg text-sm font-semibold whitespace-nowrap text-rose-700 hover:bg-rose-50 flex items-center gap-1.5 disabled:opacity-50">
                    <Trash2 className="w-4 h-4" /> Quitar este día
                  </button>
                )}
              </div>
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
              <div className="mx-3 sm:mx-5 mb-3 sm:mb-3 p-3 sm:p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-700">Agregar ejercicio al Día {dia}</h3>
                {ultimoAgregado && !alta.idEjercicio && (
                  <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 flex items-start gap-2" role="status">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <span><b>{ultimoAgregado.nombre}</b> ({ultimoAgregado.detalle}) agregado al Día {ultimoAgregado.dia}. Elegí el siguiente.</span>
                  </p>
                )}
                {catalogo.error ? <ErrorCaja mensaje={catalogo.error} /> : (
                  <>
                    <Campo label="Ejercicio" required>
                      <SelectorEjercicio catalogo={catalogo.datos} cargando={catalogo.cargando} elegido={alta.idEjercicio}
                        onElegir={(id) => cambiarAlta('idEjercicio', id)} marca={marcaDe}
                        deshabilitado={!socio || ocupado || socioInactivo} />
                    </Campo>
                    <ParametrosEjercicio valores={alta} onChange={cambiarAlta} deshabilitado={!socio || ocupado || socioInactivo} />

                    {riesgosAlta.length > 0 && (
                      <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-xl" role="alert">
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
                    {/* Si el ejercicio elegido solo lo marcó la IA, se muestra su motivo como nota violeta (no bloquea).
                        Number(...) porque el valor del <select> llega como texto y las claves del Map son números. */}
                    {riesgosAlta.length === 0 && sugerenciasIa.has(Number(alta.idEjercicio)) && (
                      <p className="p-3 text-sm bg-violet-50 border border-violet-200 rounded-xl text-violet-800 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                        <span><b>La IA sugiere evitarlo:</b> {sugerenciasIa.get(Number(alta.idEjercicio)).motivo} (no bloquea: decidís vos).</span>
                      </p>
                    )}
                    {errorAlta && <p className="text-sm text-rose-700" role="alert">{errorAlta}</p>}

                    <div className="flex flex-col sm:flex-row justify-end gap-2">
                      {riesgosAlta.length > 0 && (
                        <button onClick={() => cambiarAlta('idEjercicio', '')} disabled={ocupado} className={`${botonSecundario} bg-white`}>Elegir otro</button>
                      )}
                      {riesgosAlta.length > 0 ? (
                        <button onClick={() => agregar(true)} disabled={ocupado}
                          className="px-3 py-1.5 tactil:min-h-11 text-sm font-semibold text-white bg-alerta hover:bg-alerta-oscuro disabled:opacity-50 rounded-lg flex items-center justify-center gap-2">
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
            <div className="px-3 sm:px-4 py-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {totalDias} {totalDias === 1 ? 'día' : 'días'} · {items.length} {items.length === 1 ? 'ejercicio' : 'ejercicios'}
                {ocupado && <span className="inline-flex items-center gap-1 ml-2 text-blue-600"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</span>}
              </p>
              {modoEdicion ? (
                <button onClick={cerrar} disabled={ocupado} className={botonSecundario}>Listo, cerrar</button>
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
          ancho="max-w-2xl"
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
            {editando.error && <p className="text-sm text-rose-700" role="alert">{editando.error}</p>}
          </div>
        </Modal>
      )}
      <VistaPreviaGif hover={hoverFila} />
    </>,
  );
};

// Pasar de una rutina a otra (o a una nueva) arranca el constructor de cero. onCerrar: cerrar la ventana (Rutinas)
const ConstructorRutinas = ({ onCerrar }) => {
  const [params] = useSearchParams();
  return <Constructor key={params.get('rutina') || 'nueva'} onCerrar={onCerrar} />;
};

export default ConstructorRutinas;
