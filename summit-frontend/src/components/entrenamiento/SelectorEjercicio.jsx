import { Suspense, lazy, useMemo, useRef, useState } from 'react';
import { Search, X, PersonStanding, AlertTriangle, Sparkles, Check, Loader2 } from 'lucide-react';
import Modal from '../Modal';
import { coincide, nombreGrupo } from './comun';
import { ejerciciosDelMusculo } from './musculos';

// El modelo del cuerpo (imágenes y SVG grandes) se descarga recién cuando se abre
const ModeloHumano = lazy(() => import('../ModeloHumano'));

const chip = 'px-3.5 py-1.5 tactil:min-h-11 rounded-full text-sm font-semibold whitespace-nowrap border transition-colors flex items-center gap-1.5 shrink-0';
const chipActivo = 'bg-blue-600 text-white border-blue-600';
const chipInactivo = 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';

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

// Botón de un ejercicio de la lista: todo el renglón se toca (48 px o más)
const Opcion = ({ ejercicio, marca, onElegir }) => (
  <li>
    <button type="button" onClick={() => onElegir(ejercicio)}
      className="w-full min-h-12 text-left px-3 py-1.5 flex items-center gap-3 hover:bg-blue-50 active:bg-blue-100 focus:outline-hidden focus-visible:bg-blue-50">
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
  const listaRef = useRef(null);

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
    onElegir(String(ejercicio.idEjercicio));
    setTexto('');
    setCuerpoAbierto(false);
  };

  // Elegido: tarjeta con el ejercicio y "Cambiar"
  if (ejercicioElegido) {
    return (
      <div className="flex items-center gap-3 p-3 bg-blue-50/60 border border-blue-100 rounded-xl">
        <span className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0"><Check className="w-5 h-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800 leading-snug">{ejercicioElegido.nombre}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{nombreGrupo(ejercicioElegido.grupoMuscular)}</span>
            <Marca marca={marca(ejercicioElegido)} />
          </div>
        </div>
        <button type="button" onClick={() => onElegir('')} disabled={deshabilitado}
          className="text-sm font-semibold text-blue-700 hover:bg-blue-100 px-3 py-1.5 tactil:min-h-11 rounded-lg shrink-0 disabled:opacity-50">
          Cambiar
        </button>
      </div>
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
        <button type="button" onClick={() => setCuerpoAbierto(true)} disabled={deshabilitado || cargando}
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
          <ul ref={listaRef} className="max-h-80 overflow-y-auto divide-y divide-slate-100 overscroll-contain" aria-label="Ejercicios del catálogo">
            {resultados.map((e) => <Opcion key={e.idEjercicio} ejercicio={e} marca={marca(e)} onElegir={elegir} />)}
          </ul>
        )}
      </div>
      {!cargando && resultados.length > 0 && (
        <p className="text-xs text-slate-500">{resultados.length} {resultados.length === 1 ? 'ejercicio' : 'ejercicios'}: tocá uno para elegirlo.</p>
      )}

      {cuerpoAbierto && (
        <Modal titulo="Elegí por el cuerpo" subtitulo="Tocá una zona y después el músculo: abajo aparecen sus ejercicios del catálogo."
          onClose={() => setCuerpoAbierto(false)} ancho="max-w-5xl">
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
                  <div className="mb-3 space-y-3">
                    {d.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Ejercicios del catálogo</p>
                        <ul className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                          {d.map((e) => <Opcion key={e.idEjercicio} ejercicio={e} marca={marca(e)} onElegir={elegir} />)}
                        </ul>
                      </div>
                    )}
                    {g.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Más de {nombreGrupo(gr)}</p>
                        <ul className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                          {g.map((e) => <Opcion key={e.idEjercicio} ejercicio={e} marca={marca(e)} onElegir={elegir} />)}
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
    </div>
  );
};

export default SelectorEjercicio;
