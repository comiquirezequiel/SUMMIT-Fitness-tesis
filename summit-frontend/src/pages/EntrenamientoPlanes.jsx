import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ClipboardList, Search, Plus, Eye, Pencil, Ban, RefreshCw, UserX, Download,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import { botonPrimario, botonSecundario } from '../components/Campo';
import DetalleRutina from '../components/entrenamiento/DetalleRutina';
import { Cargando, ErrorCaja, Vacio, Aviso } from '../components/entrenamiento/Estados';
import BotonesPdf from '../components/pdf/BotonesPdf';
import { documentoRutina } from '../components/pdf/rutina';
import {
  obtenerJson, enviarJson, puedeEditarEntrenamiento, coincide,
} from '../components/entrenamiento/comun';
import { formatFecha, usuarioActual, descargarCsv, hoyIso } from '../utils/formato';

/**
 * Rutinas: socios con su rutina activa (y los activos que no tienen) para el profesor y el admin. No sigue lo que
 * entrena cada socio: la rutina le llega impresa o digital.
 * Datos: GET /rutinas (resumen de las rutinas activas en una consulta) + GET /socios.
 */
const EntrenamientoPlanes = () => {
  const navigate = useNavigate();
  const usuario = usuarioActual();
  const puedeEditar = puedeEditarEntrenamiento(usuario);

  const [rutinas, setRutinas] = useState([]);
  const [socios, setSocios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('TODOS');
  const [aviso, setAviso] = useState(null);
  const [detalle, setDetalle] = useState(null); // { fila, rutina, cargando, error }
  const [desactivando, setDesactivando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [listaRutinas, listaSocios] = await Promise.all([
        obtenerJson('/rutinas', 'No se pudieron cargar las rutinas.'),
        obtenerJson('/socios', 'No se pudo cargar la lista de socios.'),
      ]);
      setRutinas(listaRutinas);
      setSocios(listaSocios);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

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
    // tactil: (tailwind.config.js) en el celular y la tablet, 44 px de alto y letra más grande
    const boton = 'px-2.5 py-1.5 tactil:min-h-11 tactil:px-3.5 text-xs tactil:text-sm font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50';
    if (!rutina) {
      return puedeEditar ? (
        <button onClick={() => navigate(`/rutinas/constructor?socio=${socio.idSocio}`)}
          className={`${boton} border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 ${enTarjeta ? 'w-full sm:w-auto' : ''}`}>
          <Plus className="w-3.5 h-3.5" /> Nueva rutina
        </button>
      ) : <span className="text-xs text-slate-400">—</span>;
    }
    return (
      <div className={enTarjeta ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-1.5 justify-end'}>
        <button onClick={() => ver(fila)} className={`${boton} border-slate-200 text-slate-600 hover:bg-slate-50`}>
          <Eye className="w-3.5 h-3.5" /> Ver
        </button>
        {puedeEditar && (
          <button onClick={() => navigate(`/rutinas/constructor?rutina=${rutina.idRutina}`)}
            className={`${boton} border-blue-200 text-blue-700 hover:bg-blue-50`}>
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        )}
        {puedeEditar && (
          <button onClick={() => desactivar(fila)} disabled={desactivando === rutina.idRutina}
            className={`${boton} border-rose-200 text-rose-600 hover:bg-rose-50`}>
            <Ban className="w-3.5 h-3.5" /> {desactivando === rutina.idRutina ? 'Desactivando...' : 'Desactivar'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Rutinas</h1>
          <p className="text-sm text-slate-500">Rutina activa de cada socio y quién todavía no tiene</p>
        </div>
        {puedeEditar && (
          <button onClick={() => navigate('/rutinas/constructor')} className={`${botonPrimario} whitespace-nowrap shadow-xs`}>
            <Plus className="w-4 h-4" /> Nueva rutina
          </button>
        )}
      </div>

      {!puedeEditar && (
        <Aviso tipo="info">Modo consulta: las rutinas las arman y modifican los profesores y los administradores.</Aviso>
      )}
      {aviso && <Aviso tipo={aviso.tipo} onCerrar={() => setAviso(null)}>{aviso.texto}</Aviso>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Rutinas activas" value={cargando ? '…' : String(conteo.CON)} icon={ClipboardList}
          iconColor="text-blue-500" iconBg="bg-blue-50" subtitle="Una por socio" />
        <StatCard title="Socios sin rutina" value={cargando ? '…' : String(conteo.SIN)} icon={UserX}
          iconColor="text-slate-500" iconBg="bg-slate-100" subtitle="Socios activos" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por socio, DNI, rutina o profesor..." aria-label="Buscar rutinas"
              className="w-full pl-9 pr-4 py-2 tactil:min-h-11 border-0 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm tactil:text-base focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all" />
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={exportar} disabled={visibles.length === 0}
              className="flex-1 sm:flex-none justify-center border border-slate-200 rounded-lg px-3 py-2 tactil:min-h-11 text-sm font-semibold text-slate-700 flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50 bg-white">
              <Download className="w-4 h-4 text-slate-500" /> Exportar
            </button>
            <button onClick={cargar} title="Actualizar" aria-label="Actualizar"
              className="border border-slate-200 rounded-lg p-2 tactil:w-11 tactil:h-11 flex items-center justify-center text-slate-500 hover:bg-slate-50 bg-white">
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar" role="tablist" aria-label="Filtrar socios">
          {filtros.map((f) => (
            <button key={f.valor} role="tab" aria-selected={filtro === f.valor} onClick={() => setFiltro(f.valor)}
              className={`px-3 py-1.5 tactil:min-h-11 tactil:px-4 rounded-full text-xs tactil:text-sm font-semibold whitespace-nowrap border transition-colors shrink-0 ${filtro === f.valor
                ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {f.texto} ({conteo[f.valor]})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {error ? (
          <div className="p-4"><ErrorCaja mensaje={error} onReintentar={cargar} /></div>
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
            <ul className="xl:hidden p-3 grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))]">
              {visibles.map((fila) => (
                <li key={fila.socio.idSocio} className="p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{fila.socio.nombreCompleto}</p>
                      <p className="text-xs text-slate-500">DNI {fila.socio.dni || '—'}</p>
                    </div>
                    {!fila.rutina && <span className="text-[11px] font-bold px-2 py-0.5 h-fit rounded-sm bg-slate-100 text-slate-500 shrink-0">SIN RUTINA</span>}
                  </div>
                  {fila.rutina && (
                    <div className="text-sm text-slate-600 space-y-1 flex-1">
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
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Socio</th>
                    <th className="px-5 py-3.5 font-medium">Rutina activa</th>
                    <th className="px-5 py-3.5 font-medium whitespace-nowrap">Días · Ejercicios</th>
                    <th className="px-5 py-3.5 font-medium">Profesor</th>
                    <th className="px-5 py-3.5 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibles.map((fila) => (
                    <tr key={fila.socio.idSocio} className="hover:bg-slate-50 transition-colors align-top">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-800">{fila.socio.nombreCompleto}</div>
                        <div className="text-xs text-slate-500">DNI {fila.socio.dni || '—'}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        {fila.rutina ? (
                          <>
                            <div className="font-medium text-slate-800">{fila.rutina.nombre}</div>
                            <div className="text-xs text-slate-500">{fila.rutina.objetivo || 'Sin objetivo'} · desde {formatFecha(fila.rutina.fechaCreacion)}</div>
                          </>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-sm bg-slate-100 text-slate-500">SIN RUTINA</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                        {fila.rutina ? `${fila.rutina.totalDias} ${fila.rutina.totalDias === 1 ? 'día' : 'días'} · ${fila.rutina.cantidadEjercicios}` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{fila.rutina ? (fila.rutina.nombreProfesor || 'Sin profesor') : '—'}</td>
                      <td className="px-5 py-3.5">{acciones(fila)}</td>
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
                <button onClick={() => navigate(`/rutinas/constructor?rutina=${detalle.fila.rutina.idRutina}`)} className={botonPrimario}>
                  <Pencil className="w-4 h-4" /> Editar rutina
                </button>
              )}
            </>
          )}
        >
          {detalle.cargando ? <Cargando texto="Cargando rutina..." />
            : detalle.error ? <ErrorCaja mensaje={detalle.error} onReintentar={() => ver(detalle.fila)} />
              : (
                <div className="space-y-4">
                  {documentoPdf && <BotonesPdf documento={documentoPdf} className="pb-4 border-b border-slate-100" />}
                  <DetalleRutina rutina={detalle.rutina} />
                </div>
              )}
        </Modal>
      )}
    </div>
  );
};

export default EntrenamientoPlanes;
