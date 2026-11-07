import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, PersonStanding, AlertTriangle, Sparkles, Check, Loader2, Dumbbell } from 'lucide-react';
import Modal from '../Modal';
import { coincide, nombreGrupo, resolverUrlMedia } from './comun';
import { ejerciciosDelMusculo } from './musculos';

// El modelo del cuerpo (imágenes y SVG grandes) se descarga recién cuando se abre
const ModeloHumano = lazy(() => import('../ModeloHumano'));

const chip = 'px-3.5 py-1.5 tactil:min-h-11 rounded-full text-sm font-semibold whitespace-nowrap border transition-colors flex items-center gap-1.5 shrink-0';
const chipActivo = 'bg-blue-600 text-white border-blue-600';
const chipInactivo = 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';

export const calcularPosicionHover = (clientX, clientY) => {
  const anchoPopup = 248;
  const altoPopup = 285;
  const margen = 14;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  let x = clientX + 20;
  if (x + anchoPopup + margen > vw) {
    x = Math.max(margen, clientX - anchoPopup - 20);
  }
  let y = clientY - altoPopup / 2;
  y = Math.max(margen, Math.min(y, vh - altoPopup - margen));
  return { x, y };
};

/**
 * Vista previa flotante (hover / mouseover) que muestra el GIF demostrativo del ejercicio
 * al pasar el puntero por encima para asignarlo a la rutina.
 */
export const VistaPreviaGif = ({ hover }) => {
  const [errorImg, setErrorImg] = useState(false);
  const ejercicio = hover?.ejercicio;
  const urlGif = ejercicio ? resolverUrlMedia(ejercicio) : null;

  useEffect(() => {
    setErrorImg(false);
  }, [urlGif, ejercicio?.idEjercicio]);

  if (!ejercicio || typeof document === 'undefined') return null;
  const tieneGif = Boolean(urlGif && !errorImg);

  return createPortal(
    <div
      role="tooltip"
      aria-label={`Demostración de ${ejercicio.nombre}`}
      style={{ left: `${hover.x}px`, top: `${hover.y}px` }}
      className="fixed z-[9999] w-60 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 pointer-events-none transition-opacity duration-150"
    >
      <div
        className={`w-full h-48 rounded-xl border overflow-hidden flex items-center justify-center ${
          tieneGif ? 'border-slate-100 bg-white p-1.5' : 'border-dashed border-slate-200 bg-slate-50 p-4'
        }`}
      >
        {tieneGif ? (
          <img
            src={urlGif}
            alt={`Demostración de ${ejercicio.nombre}`}
            onError={() => setErrorImg(true)}
            className="w-full h-full object-contain rounded-lg select-none"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-slate-400 text-center">
            <Dumbbell className="w-6 h-6 opacity-60" />
            <span className="text-xs font-medium">Sin GIF demostrativo</span>
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="font-bold text-slate-800 text-sm leading-snug">{ejercicio.nombre}</p>
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mt-0.5">
          {nombreGrupo(ejercicio.grupoMuscular)}
        </p>
      </div>
    </div>,
    document.body,
  );
};

// Miniatura del GIF dentro de cada fila de ejercicio
export const MiniaturaGif = ({ ejercicio, tamano = 'w-11 h-11' }) => {
  const urlGif = resolverUrlMedia(ejercicio);
  const [errorImg, setErrorImg] = useState(false);
  const tieneGif = Boolean(urlGif && !errorImg);

  return (
    <span
      className={`${tamano} rounded-lg border shrink-0 overflow-hidden flex items-center justify-center ${
        tieneGif ? 'border-slate-200 bg-white p-0.5' : 'border-dashed border-slate-200 bg-slate-50 text-slate-400'
      }`}
    >
      {tieneGif ? (
        <img
          src={urlGif}
          alt=""
          onError={() => setErrorImg(true)}
          loading="lazy"
          className="w-full h-full object-contain select-none"
        />
      ) : (
        <Dumbbell className="w-4 h-4 opacity-50" />
      )}
    </span>
  );
};

/**
 * Marca de un ejercicio en la lista: ⚠ contraindicado (regla firme, pide confirmación al agregarlo) o ✦ lo que sugiere
 * evitar la IA (solo informa). marca: { tipo: 'riesgo' | 'ia', texto } o null.
 */
const Marca = ({ marca }) => (marca ? (
  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${marca.tipo === 'riesgo'
    ? 'bg-amber-200 text-amber-900' : 'bg-violet-100 text-violet-800'}`}>
    {marca.tipo === 'riesgo' ? <AlertTriangle className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />} {marca.texto}
  </span>
) : null);

// Botón de un ejercicio de la lista: todo el renglón se toca (48 px o más) y muestra el GIF al hacer hover/mouseover
const Opcion = ({ ejercicio, marca, onElegir, onHover, onMoverHover, onSalirHover }) => (
  <li
    onMouseEnter={(e) => onHover?.(ejercicio, e)}
    onMouseOver={(e) => onHover?.(ejercicio, e)}
    onMouseMove={(e) => onMoverHover?.(ejercicio, e)}
    onMouseLeave={() => onSalirHover?.()}
  >
    <button type="button" onClick={() => onElegir(ejercicio)}
      className="w-full min-h-12 text-left px-3 py-1.5 flex items-center gap-3 hover:bg-blue-50 active:bg-blue-100 focus:outline-hidden focus-visible:bg-blue-50">
      <MiniaturaGif ejercicio={ejercicio} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-800 leading-snug">{ejercicio.nombre}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{nombreGrupo(ejercicio.grupoMuscular)}</span>
          <Marca marca={marca} />
        </span>
      </span>
    </button>
  </li>
);

/**
 * Elegir un ejercicio del catálogo con el dedo: buscador, grupos musculares y lista, o tocando el cuerpo.
 * - catalogo: ejercicios de GET /ejercicios. elegido: el id elegido ('' si ninguno); onElegir(id): '' para cambiarlo
 * - marca(ejercicio): para avisar contraindicados y sugerencias de la IA (ver Marca)
 */
const SelectorEjercicio = ({ catalogo, cargando, elegido, onElegir, marca = () => null, deshabilitado }) => {
  const [texto, setTexto] = useState('');
  const [grupo, setGrupo] = useState('');
  const [musculo, setMusculo] = useState(null); // { id, titulo } elegido en el cuerpo
  const [cuerpoAbierto, setCuerpoAbierto] = useState(false);
  const [hover, setHover] = useState(null); // { ejercicio, x, y }
  const listaRef = useRef(null);

  const mostrarHover = (ejercicio, e) => {
    if (deshabilitado || !ejercicio) return;
    const { x, y } = calcularPosicionHover(e.clientX, e.clientY);
    setHover({ ejercicio, x, y });
  };

  const moverHover = (ejercicio, e) => {
    if (deshabilitado || !ejercicio) return;
    const { x, y } = calcularPosicionHover(e.clientX, e.clientY);
    setHover((prev) => (prev && prev.x === x && prev.y === y && prev.ejercicio === ejercicio ? prev : { ejercicio, x, y }));
  };

  const salirHover = () => setHover(null);

  const grupos = useMemo(() => [...new Set(catalogo.map((e) => e.grupoMuscular || 'OTRO'))]
    .sort((a, b) => nombreGrupo(a).localeCompare(nombreGrupo(b), 'es')), [catalogo]);

  const resultados = useMemo(() => {
    let lista = catalogo;
    if (musculo) {
      const { directos, delGrupo } = ejerciciosDelMusculo(catalogo, musculo.id);
      lista = [...directos, ...delGrupo];
    } else if (grupo) {
      lista = lista.filter((e) => (e.grupoMuscular || 'OTRO') === grupo);
    }
    // Cada palabra por separado: "press banca" encuentra "Press de banca plano"
    const palabras = texto.trim().split(/\s+/).filter(Boolean);
    return lista.filter((e) => palabras.every((p) => coincide(p, e.nombre, nombreGrupo(e.grupoMuscular))));
  }, [catalogo, texto, grupo, musculo]);

  const ejercicioElegido = elegido ? catalogo.find((e) => String(e.idEjercicio) === String(elegido)) : null;

  // La búsqueda ya cumplió: para el próximo ejercicio la lista arranca sin texto (el grupo elegido queda)
  const elegir = (ejercicio) => {
    setHover(null);
    onElegir(String(ejercicio.idEjercicio));
    setTexto('');
    setCuerpoAbierto(false);
  };

  // Elegido: tarjeta con el ejercicio y "Cambiar"
  if (ejercicioElegido) {
    return (
      <>
        <div
          onMouseEnter={(e) => mostrarHover(ejercicioElegido, e)}
          onMouseOver={(e) => mostrarHover(ejercicioElegido, e)}
          onMouseMove={(e) => moverHover(ejercicioElegido, e)}
          onMouseLeave={salirHover}
          className="flex items-center gap-3 p-3 bg-blue-50/60 border border-blue-100 rounded-xl"
        >
          <span className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0"><Check className="w-5 h-5" /></span>
          <MiniaturaGif ejercicio={ejercicioElegido} tamano="w-12 h-12" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-800 leading-snug">{ejercicioElegido.nombre}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{nombreGrupo(ejercicioElegido.grupoMuscular)}</span>
              <Marca marca={marca(ejercicioElegido)} />
            </div>
          </div>
          <button type="button" onClick={() => { setHover(null); onElegir(''); }} disabled={deshabilitado}
            className="text-sm font-semibold text-blue-700 hover:bg-blue-100 px-3 py-1.5 tactil:min-h-11 rounded-lg shrink-0 disabled:opacity-50">
            Cambiar
          </button>
        </div>
        <VistaPreviaGif hover={!deshabilitado ? hover : null} />
      </>
    );
  }

  const teclas = (e) => {
    if (e.key === 'Enter' && resultados.length === 1) { e.preventDefault(); elegir(resultados[0]); }
    if (e.key === 'ArrowDown') { e.preventDefault(); listaRef.current?.querySelector('button')?.focus(); }
  };

  const { directos = [], delGrupo = [], grupo: grupoDelMusculo } = musculo ? ejerciciosDelMusculo(catalogo, musculo.id) : {};

  return (
    <div className={`space-y-3 ${deshabilitado ? 'opacity-60 pointer-events-none' : ''}`} aria-disabled={deshabilitado || undefined}>
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={teclas} disabled={deshabilitado}
            placeholder={cargando ? 'Cargando catálogo...' : 'Buscar ejercicio...'} aria-label="Buscar ejercicio en el catálogo"
            className="w-full pl-8 pr-9 py-1.5 tactil:min-h-11 bg-white border border-slate-200 rounded-lg text-sm tactil:text-base focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400 [&::-webkit-search-cancel-button]:hidden" />
          {texto && (
            <button type="button" onClick={() => setTexto('')} aria-label="Borrar búsqueda"
              className="absolute right-0 top-0 h-full w-8 tactil:w-11 flex items-center justify-center text-slate-500 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button type="button" onClick={() => { setHover(null); setCuerpoAbierto(true); }} disabled={deshabilitado || cargando}
          className="px-3 py-1.5 tactil:min-h-11 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shrink-0 disabled:opacity-50">
          <PersonStanding className="w-4 h-4 text-blue-600" /> Por el cuerpo
        </button>
      </div>

      {/* Grupos musculares: se deslizan de costado en pantallas chicas */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 hide-scrollbar" role="group" aria-label="Filtrar por grupo muscular">
        {musculo ? (
          <button type="button" onClick={() => setMusculo(null)} className={`${chip} ${chipActivo}`} aria-label={`Quitar el filtro ${musculo.titulo}`}>
            <PersonStanding className="w-4 h-4" /> {musculo.titulo} <X className="w-4 h-4" />
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setGrupo('')} aria-pressed={!grupo} className={`${chip} ${!grupo ? chipActivo : chipInactivo}`}>Todos</button>
            {grupos.map((g) => (
              <button key={g} type="button" onClick={() => setGrupo(grupo === g ? '' : g)} aria-pressed={grupo === g}
                className={`${chip} ${grupo === g ? chipActivo : chipInactivo}`}>
                {nombreGrupo(g)}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {cargando ? (
          <p className="p-3 text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando catálogo...</p>
        ) : resultados.length === 0 ? (
          <div className="p-3 text-sm text-slate-500 space-y-2">
            <p>{catalogo.length === 0 ? 'El catálogo no tiene ejercicios.' : 'Ningún ejercicio coincide: probá con otra palabra u otro grupo.'}</p>
            {/* Con un grupo o un músculo elegido, la búsqueda queda adentro de ese filtro: un toque la abre a todo */}
            {texto.trim() && (grupo || musculo) && (
              <button type="button" onClick={() => { setGrupo(''); setMusculo(null); }}
                className="px-3 py-1.5 tactil:min-h-11 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100">
                Buscar “{texto.trim()}” en todos los grupos
              </button>
            )}
          </div>
        ) : (
          <ul
            ref={listaRef}
            onScroll={salirHover}
            onMouseLeave={salirHover}
            className="max-h-80 overflow-y-auto divide-y divide-slate-100 overscroll-contain"
            aria-label="Ejercicios del catálogo"
          >
            {resultados.map((e) => (
              <Opcion
                key={e.idEjercicio}
                ejercicio={e}
                marca={marca(e)}
                onElegir={elegir}
                onHover={mostrarHover}
                onMoverHover={moverHover}
                onSalirHover={salirHover}
              />
            ))}
          </ul>
        )}
      </div>
      {!cargando && resultados.length > 0 && (
        <p className="text-xs text-slate-500">{resultados.length} {resultados.length === 1 ? 'ejercicio' : 'ejercicios'}: pasá el puntero para ver su GIF o tocá uno para elegirlo.</p>
      )}

      {cuerpoAbierto && (
        <Modal titulo="Elegí por el cuerpo" subtitulo="Tocá una zona y después el músculo: abajo aparecen sus ejercicios del catálogo."
          onClose={() => { setHover(null); setCuerpoAbierto(false); }} ancho="max-w-5xl">
          <Suspense fallback={<p className="p-4 text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando el modelo...</p>}>
            <ModeloHumano
              estilo={{ height: 'min(64dvh, 680px)', minHeight: 0 }}
              onMuscleSelect={(id, titulo) => { setMusculo({ id, titulo }); setTexto(''); }}
              extraAntes
              contenidoExtra={(id) => {
                const { directos: d, delGrupo: g, grupo: gr } = ejerciciosDelMusculo(catalogo, id);
                if (d.length + g.length === 0) {
                  return <p className="text-sm text-slate-500 mb-3">El catálogo no tiene ejercicios para este músculo.</p>;
                }
                return (
                  <div className="mb-3 space-y-3" onMouseLeave={salirHover}>
                    {d.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Ejercicios del catálogo</p>
                        <ul className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                          {d.map((e) => (
                            <Opcion
                              key={e.idEjercicio}
                              ejercicio={e}
                              marca={marca(e)}
                              onElegir={elegir}
                              onHover={mostrarHover}
                              onMoverHover={moverHover}
                              onSalirHover={salirHover}
                            />
                          ))}
                        </ul>
                      </div>
                    )}
                    {g.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Más de {nombreGrupo(gr)}</p>
                        <ul className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                          {g.map((e) => (
                            <Opcion
                              key={e.idEjercicio}
                              ejercicio={e}
                              marca={marca(e)}
                              onElegir={elegir}
                              onHover={mostrarHover}
                              onMoverHover={moverHover}
                              onSalirHover={salirHover}
                            />
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </Suspense>
          {musculo && (directos.length + delGrupo.length > 0) && (
            <p className="text-xs text-slate-500 mt-2">
              Si cerrás, la lista queda filtrada por {musculo.titulo}{grupoDelMusculo ? ` (y el resto de ${nombreGrupo(grupoDelMusculo)})` : ''}.
            </p>
          )}
        </Modal>
      )}
      <VistaPreviaGif hover={!deshabilitado ? hover : null} />
    </div>
  );
};

export default SelectorEjercicio;
