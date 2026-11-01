import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useCarga } from '../hooks/useCarga';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  ClipboardList, Plus, Eye, Pencil, Ban, RefreshCw, UserX, Download, LayoutTemplate, ChevronDown,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import Encabezado from '../components/Encabezado';
import { Buscador, botonPrimario, botonSecundario, botonHerramienta, selectorHerramienta } from '../components/Campo';
import DetalleRutina from '../components/entrenamiento/DetalleRutina';
import { Cargando, ErrorCaja, Vacio, Aviso } from '../components/entrenamiento/Estados';
import BotonesPdf from '../components/pdf/BotonesPdf';
import { documentoRutina } from '../components/pdf/rutina';
import { PLANTILLAS, resumenPlantilla } from '../components/entrenamiento/plantillas';
import {
  obtenerJson, enviarJson, puedeEditarEntrenamiento, coincide,
} from '../components/entrenamiento/comun';
import { formatFecha, usuarioActual, descargarCsv, hoyIso } from '../utils/formato';

// El constructor (con el catálogo, la ficha médica y la IA) se descarga recién cuando se abre
const ConstructorRutinas = lazy(() => import('./ConstructorRutinas'));

// Preferencia de cada computadora: el panel de rutinas predeterminadas abierto o cerrado
const CLAVE_PLANTILLAS = 'summit.rutinas.plantillas';
const leerPlantillasAbiertas = () => {
  try {
    return localStorage.getItem(CLAVE_PLANTILLAS) !== '0';
  } catch {
    return true;
  }
};

/**
 * Rutinas: socios con su rutina activa (y los activos que no tienen) para el profesor y el admin, con las rutinas
 * predeterminadas para asignar rápido. No sigue lo que entrena cada socio: la rutina le llega impresa o digital.
 * El constructor ya no es una pantalla fija: se abre en una ventana con "+ Nueva rutina", "Editar" o una rutina
 * predeterminada, y la dirección dice qué hay abierto (?nueva=1&socio=&plantilla= o ?rutina=).
 * Datos: GET /rutinas (resumen de las rutinas activas en una consulta) + GET /socios.
 */
const EntrenamientoPlanes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const usuario = usuarioActual();
  const puedeEditar = puedeEditarEntrenamiento(usuario);

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('TODOS');
  const [aviso, setAviso] = useState(null);
  const [detalle, setDetalle] = useState(null); // { fila, rutina, cargando, error }
  const [desactivando, setDesactivando] = useState(null);
  const [verPlantillas, setVerPlantillas] = useState(leerPlantillasAbiertas);

  const { datos, cargando, error, cargar } = useCarga(async () => {
    const [rutinas, socios] = await Promise.all([
      obtenerJson('/rutinas', 'No se pudieron cargar las rutinas.'),
      obtenerJson('/socios', 'No se pudo cargar la lista de socios.'),
    ]);
    return { rutinas, socios };
  }, [], { rutinas: [], socios: [] });
  const { rutinas, socios } = datos;

  // ---- Constructor en ventana ----
  const constructorAbierto = puedeEditar && (params.has('rutina') || params.has('nueva'));
  // Abrir suma un paso al historial: "Atrás" cierra la ventana y deja la lista como estaba
  const abrirConstructor = (busquedaUrl) => {
    setDetalle(null);
    navigate({ search: `?${new URLSearchParams(busquedaUrl)}` }, { state: { desdeLista: true } });
  };
  const cerrarConstructor = () => {
    if (location.state?.desdeLista) navigate(-1);
    else navigate({ search: '' }, { replace: true });
  };
  // Al cerrar la ventana (con la X, "Listo" o "Atrás"), la lista vuelve a leer las rutinas
  const estabaAbierto = useRef(constructorAbierto);
  useEffect(() => {
    if (estabaAbierto.current && !constructorAbierto) cargar();
    estabaAbierto.current = constructorAbierto;
  }, [constructorAbierto, cargar]);

  const alternarPlantillas = () => {
    setVerPlantillas(!verPlantillas);
    try {
      localStorage.setItem(CLAVE_PLANTILLAS, verPlantillas ? '0' : '1');
    } catch {
      // sin almacenamiento (ventana privada): vale solo mientras la pantalla está abierta
    }
  };

  // Una fila por socio: su rutina activa (la más reciente) o, si es un socio activo, "sin rutina"
  const filas = useMemo(() => {
    const sociosPorId = new Map(socios.map((s) => [s.idSocio, s]));
    const conRutina = new Map();
    for (const r of rutinas) {
      if (!conRutina.has(r.idSocio)) conRutina.set(r.idSocio, r);
    }
    const lista = [...conRutina.values()].map((r) => ({
      socio: sociosPorId.get(r.idSocio) || { idSocio: r.idSocio, nombreCompleto: r.nombreSocio, dni: '', estado: 'ACTIVO' },
      rutina: r,
    }));
    for (const s of socios) {
      if (!conRutina.has(s.idSocio) && s.estado === 'ACTIVO') lista.push({ socio: s, rutina: null });
    }
    return lista.sort((a, b) => a.socio.nombreCompleto.localeCompare(b.socio.nombreCompleto, 'es'));
  }, [rutinas, socios]);

  const conteo = useMemo(() => ({
    TODOS: filas.length,
    CON: filas.filter((f) => f.rutina).length,
    SIN: filas.filter((f) => !f.rutina).length,
    MIAS: filas.filter((f) => f.rutina?.idProfesor === usuario?.idUsuario).length,
  }), [filas, usuario?.idUsuario]);

  const filtros = [
    { valor: 'TODOS', texto: 'Todos' },
    { valor: 'CON', texto: 'Con rutina' },
    { valor: 'SIN', texto: 'Sin rutina' },
    ...(usuario?.rol === 'PROFESOR' ? [{ valor: 'MIAS', texto: 'Armadas por mí' }] : []),
  ];

  const visibles = filas.filter((f) => {
    if (filtro === 'CON' && !f.rutina) return false;
    if (filtro === 'SIN' && f.rutina) return false;
    if (filtro === 'MIAS' && f.rutina?.idProfesor !== usuario?.idUsuario) return false;
    return coincide(busqueda, f.socio.nombreCompleto, f.socio.dni, f.socio.email, f.rutina?.nombre,
      f.rutina?.objetivo, f.rutina?.nombreProfesor);
  });

  // PDF de la rutina abierta en "Ver" (se arma una vez por rutina cargada)
  const documentoPdf = useMemo(
    () => (detalle?.rutina ? documentoRutina(detalle.rutina, { objetivoSocio: detalle.fila.socio.objetivo }) : null),
    [detalle?.rutina, detalle?.fila],
  );

  const ver = async (fila) => {
    setDetalle({ fila, rutina: null, cargando: true, error: '' });
    try {
      const rutina = await obtenerJson(`/rutinas/${fila.rutina.idRutina}`, 'No se pudo cargar la rutina.');
      setDetalle({ fila, rutina, cargando: false, error: '' });
    } catch (e) {
      setDetalle({ fila, rutina: null, cargando: false, error: e.message });
    }
  };

  const desactivar = async (fila) => {
    const { rutina, socio } = fila;
    if (!window.confirm(`¿Desactivar la rutina "${rutina.nombre}" de ${socio.nombreCompleto}?\n\n`
      + 'No se borra: queda guardada como inactiva.')) return;
    setDesactivando(rutina.idRutina);
    const r = await enviarJson(`/rutinas/${rutina.idRutina}`, 'DELETE');
    setDesactivando(null);
    if (r.ok) {
      setAviso({ tipo: 'exito', texto: `Rutina "${rutina.nombre}" de ${socio.nombreCompleto} desactivada.` });
      setDetalle(null);
      cargar();
    } else {
      setAviso({ tipo: 'error', texto: r.data?.error || 'No se pudo desactivar la rutina.' });
    }
  };

  const exportar = () => {
    descargarCsv(`rutinas-${hoyIso()}.csv`,
      ['Socio', 'DNI', 'Rutina', 'Objetivo', 'Días', 'Ejercicios', 'Profesor', 'Creada'],
      visibles.map(({ socio, rutina }) => [
        socio.nombreCompleto, socio.dni, rutina?.nombre || 'Sin rutina', rutina?.objetivo, rutina?.totalDias,
        rutina?.cantidadEjercicios, rutina?.nombreProfesor, rutina ? formatFecha(rutina.fechaCreacion) : '',
      ]));
  };

  // En las tarjetas (celular y tablet) los botones se reparten el ancho; en la tabla van a la derecha
  const acciones = (fila, enTarjeta = false) => {
    const { socio, rutina } = fila;
    // tactil: (index.css) en el celular y la tablet, 44 px de alto y letra más grande
    const boton = 'px-2 py-1 tactil:min-h-11 tactil:px-3.5 text-xs tactil:text-sm font-semibold rounded-lg border flex items-center justify-center gap-1 transition-colors disabled:opacity-50';
    if (!rutina) {
      return puedeEditar ? (
        <div className={enTarjeta ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-1.5 justify-end'}>
          <button onClick={() => abrirConstructor({ nueva: '1', socio: String(socio.idSocio) })}
            className={`${boton} border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100`}>
            <Plus className="w-3.5 h-3.5" /> Nueva rutina
          </button>
          {/* Asignación rápida: abre el constructor con el socio y la rutina predeterminada ya cargados */}
          <select value="" aria-label={`Asignarle una rutina predeterminada a ${socio.nombreCompleto}`}
            onChange={(e) => abrirConstructor({ nueva: '1', socio: String(socio.idSocio), plantilla: e.target.value })}
            className={`${boton} border-violet-200 text-violet-700 bg-white hover:bg-violet-50 ${enTarjeta ? 'w-full' : 'w-36'}`}>
            <option value="">Predeterminada…</option>
            {PLANTILLAS.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({resumenPlantilla(p)})</option>)}
          </select>
        </div>
      ) : <span className="text-xs text-slate-500">—</span>;
    }
    return (
      <div className={enTarjeta ? `grid gap-2 ${puedeEditar ? 'grid-cols-3' : 'grid-cols-1'}` : 'flex flex-wrap gap-1.5 justify-end'}>
        <button onClick={() => ver(fila)} className={`${boton} border-slate-200 text-slate-600 hover:bg-slate-50`}>
          <Eye className="w-3.5 h-3.5" /> Ver
        </button>
        {puedeEditar && (
          <button onClick={() => abrirConstructor({ rutina: String(rutina.idRutina) })}
            className={`${boton} border-blue-200 text-blue-700 hover:bg-blue-50`}>
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        )}
        {puedeEditar && (
          <button onClick={() => desactivar(fila)} disabled={desactivando === rutina.idRutina}
            className={`${boton} border-rose-200 text-rose-700 hover:bg-rose-50`}>
            <Ban className="w-3.5 h-3.5" /> {desactivando === rutina.idRutina ? 'Desactivando...' : 'Desactivar'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Encabezado titulo="Rutinas" icono={ClipboardList} subtitulo="Rutina activa de cada socio y quién todavía no tiene"
        acciones={puedeEditar && (
          <button onClick={() => abrirConstructor({ nueva: '1' })} className={`${botonPrimario} whitespace-nowrap shadow-xs`}>
            <Plus className="w-4 h-4" /> Nueva rutina
          </button>
        )} />

      {!puedeEditar && (
        <Aviso tipo="info">Modo consulta: las rutinas las arman y modifican los profesores y los administradores.</Aviso>
      )}
      {aviso && <Aviso tipo={aviso.tipo} onCerrar={() => setAviso(null)}>{aviso.texto}</Aviso>}

      <div className="grid grid-cols-2 gap-2">
        <StatCard title="Rutinas activas" value={cargando ? '…' : String(conteo.CON)} icon={ClipboardList}
          iconColor="text-blue-500" iconBg="bg-blue-50" subtitle="Una por socio" />
        <StatCard title="Socios sin rutina" value={cargando ? '…' : String(conteo.SIN)} icon={UserX}
          iconColor="text-slate-500" iconBg="bg-slate-100" subtitle="Socios activos" />
      </div>

      {puedeEditar && (
        <section className="bg-white border border-slate-200 rounded-xl shadow-xs" aria-label="Rutinas predeterminadas">
          <button type="button" onClick={alternarPlantillas} aria-expanded={verPlantillas}
            className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left rounded-xl hover:bg-slate-50/60">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5 self-center">
                <LayoutTemplate className="w-4 h-4 text-violet-600" /> Rutinas predeterminadas
              </span>
              <span className="text-xs text-slate-500">Plantillas listas para asignar: se cargan en el constructor y se ajustan al socio</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${verPlantillas ? 'rotate-180' : ''}`} />
          </button>
          {verPlantillas && (
            <ul className="px-3 pb-3 grid gap-2 grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))]">
              {PLANTILLAS.map((p) => (
                <li key={p.id} className="rounded-lg border border-slate-200 p-2.5 flex flex-col gap-1 hover:border-violet-300 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{p.nombre}</p>
                    <span className="text-xs font-semibold px-1.5 py-px rounded-full bg-violet-50 text-violet-700 border border-violet-200 shrink-0">{p.nivel}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-snug flex-1">{p.descripcion}</p>
                  <p className="text-xs text-slate-600"><b className="font-semibold">{p.objetivo}</b> · {resumenPlantilla(p)}</p>
                  <button onClick={() => abrirConstructor({ nueva: '1', plantilla: p.id })}
                    className="mt-1 px-2 py-1 tactil:min-h-11 rounded-md border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 flex items-center justify-center gap-1">
                    <Plus className="w-3 h-3" /> Usar plantilla
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {/* Buscador angosto y, en la misma fila, el filtro desplegable con Exportar y Actualizar */}
        <div className="px-3 py-2 border-b border-slate-200 flex flex-wrap items-center gap-2">
          <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar socio, DNI, rutina o profesor..."
            etiqueta="Buscar rutinas" className="w-full sm:w-64" />
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar socios" className={selectorHerramienta}>
            {filtros.map((f) => <option key={f.valor} value={f.valor}>{f.texto} ({conteo[f.valor]})</option>)}
          </select>
          <button onClick={exportar} disabled={visibles.length === 0} className={botonHerramienta}>
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
          <button onClick={cargar} title="Actualizar" aria-label="Actualizar" className={botonHerramienta}>
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          </button>
          {!cargando && filas.length > 0 && (
            <span className="text-xs text-slate-500 ml-auto">{visibles.length} de {filas.length} socios</span>
          )}
        </div>

        {error ? (
          <div className="p-3"><ErrorCaja mensaje={error} onReintentar={cargar} /></div>
        ) : cargando && filas.length === 0 ? (
          <Cargando texto="Cargando rutinas..." />
        ) : visibles.length === 0 ? (
          <Vacio icono={ClipboardList} titulo={filas.length === 0 ? 'Todavía no hay socios activos ni rutinas.' : 'Ningún socio coincide con el filtro.'}>
            {filas.length > 0 && 'Probá con otra búsqueda u otro filtro.'}
          </Vacio>
        ) : (
          <>
            {/* Celular y tablet: tarjetas, de a dos cuando entran (con el menú lateral, una tablet acostada deja unos
                720 px: la tabla no entra sin apretar todo) */}
            <ul className="xl:hidden p-2.5 grid gap-2 grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))]">
              {visibles.map((fila) => (
                <li key={fila.socio.idSocio} className="p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{fila.socio.nombreCompleto}</p>
                      <p className="text-xs text-slate-500">DNI {fila.socio.dni || '—'}</p>
                    </div>
                    {!fila.rutina && <span className="text-xs font-bold px-1.5 py-0.5 h-fit rounded-sm bg-slate-100 text-slate-600 shrink-0">SIN RUTINA</span>}
                  </div>
                  {fila.rutina && (
                    <div className="text-sm text-slate-600 space-y-0.5 flex-1">
                      <p><span className="font-semibold text-slate-800">{fila.rutina.nombre}</span>{fila.rutina.objetivo ? ` · ${fila.rutina.objetivo}` : ''}</p>
                      <p className="text-xs">{fila.rutina.totalDias} {fila.rutina.totalDias === 1 ? 'día' : 'días'} · {fila.rutina.cantidadEjercicios} ejercicios · {fila.rutina.nombreProfesor || 'Sin profesor'} · desde {formatFecha(fila.rutina.fechaCreacion)}</p>
                    </div>
                  )}
                  {acciones(fila, true)}
                </li>
              ))}
            </ul>

            {/* PC: tabla */}
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                  <tr>
                    <th className="px-3 py-2 font-medium">Socio</th>
                    <th className="px-3 py-2 font-medium">Rutina activa</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Días · Ejercicios</th>
                    <th className="px-3 py-2 font-medium">Profesor</th>
                    <th className="px-3 py-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibles.map((fila) => (
                    <tr key={fila.socio.idSocio} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{fila.socio.nombreCompleto}</div>
                        <div className="text-xs text-slate-500">DNI {fila.socio.dni || '—'}</div>
                      </td>
                      <td className="px-3 py-2">
                        {fila.rutina ? (
                          <>
                            <div className="font-medium text-slate-800">{fila.rutina.nombre}</div>
                            <div className="text-xs text-slate-500">{fila.rutina.objetivo || 'Sin objetivo'} · desde {formatFecha(fila.rutina.fechaCreacion)}</div>
                          </>
                        ) : (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600">SIN RUTINA</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {fila.rutina ? `${fila.rutina.totalDias} ${fila.rutina.totalDias === 1 ? 'día' : 'días'} · ${fila.rutina.cantidadEjercicios}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{fila.rutina ? (fila.rutina.nombreProfesor || 'Sin profesor') : '—'}</td>
                      <td className="px-3 py-2">{acciones(fila)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {detalle && (
        <Modal
          titulo={detalle.rutina?.nombre || detalle.fila.rutina.nombre}
          subtitulo={`${detalle.fila.socio.nombreCompleto} · ${detalle.fila.rutina.objetivo || 'Sin objetivo'} · ${detalle.fila.rutina.nombreProfesor || 'Sin profesor'}`}
          onClose={() => setDetalle(null)}
          ancho="max-w-2xl"
          pie={(
            <>
              <button onClick={() => setDetalle(null)} className={botonSecundario}>Cerrar</button>
              {puedeEditar && (
                <button onClick={() => abrirConstructor({ rutina: String(detalle.fila.rutina.idRutina) })} className={botonPrimario}>
                  <Pencil className="w-4 h-4" /> Editar rutina
                </button>
              )}
            </>
          )}
        >
          {detalle.cargando ? <Cargando texto="Cargando rutina..." />
            : detalle.error ? <ErrorCaja mensaje={detalle.error} onReintentar={() => ver(detalle.fila)} />
              : (
                <div className="space-y-3">
                  {documentoPdf && <BotonesPdf documento={documentoPdf} className="pb-3 border-b border-slate-100" />}
                  <DetalleRutina rutina={detalle.rutina} />
                </div>
              )}
        </Modal>
      )}

      {constructorAbierto && (
        <Suspense fallback={(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30">
            <span className="bg-white rounded-lg px-3 py-2 text-sm text-slate-500 shadow-lg">Abriendo el constructor…</span>
          </div>
        )}>
          <ConstructorRutinas onCerrar={cerrarConstructor} />
        </Suspense>
      )}
    </div>
  );
};

export default EntrenamientoPlanes;
