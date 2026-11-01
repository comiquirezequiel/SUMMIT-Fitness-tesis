import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Search, MessageCircle, Plus, RefreshCw, X, Check } from 'lucide-react';
import Modal from '../components/Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../components/Campo';
import {
  CANALES, TIPOS_TAREA, actualizarTareasPendientes, crearTarea, generarTareas, listarTareas, mensajeTarea, resolverTarea,
  textoCanal,
} from '../services/seguimiento';
import { datosDelGimnasio } from '../components/pdf';
import { apiFetch } from '../services/api';
import { enlaceWhatsApp } from '../utils/whatsapp';
import { diasHasta, formatFecha, formatFechaHora, hoyIso } from '../utils/formato';

const ESTADOS_RESUELTA = {
  HECHA: { texto: 'Hecha', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DESCARTADA: { texto: 'Descartada', clase: 'bg-slate-100 text-slate-600 border-slate-200' },
  RESUELTA: { texto: 'Se resolvió sola', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
};

// "Para hoy", "Atrasada (era para el 20/10)" o "Para el 30/10"
const textoVence = (vence) => {
  const dias = diasHasta(vence);
  if (dias === 0) return { texto: 'Para hoy', clase: 'text-blue-700' };
  if (dias < 0) return { texto: `Atrasada (era para el ${formatFecha(vence)})`, clase: 'text-rose-700' };
  return { texto: `Para el ${formatFecha(vence)}`, clase: 'text-slate-500' };
};

/** Nueva tarea manual: buscar al socio, qué hay que hacer y para cuándo. */
const NuevaTareaModal = ({ onClose, onCreada }) => {
  const [socios, setSocios] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [socio, setSocio] = useState(null);
  const [datos, setDatos] = useState({ descripcion: '', vence: hoyIso() });
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/socios').then(r => (r.ok ? r.json() : [])).then(l => setSocios(l.filter(s => s.estado !== 'CANCELADO'))).catch(() => setSocios([]));
  }, []);
  const filtro = busqueda.trim().toLowerCase();
  const resultados = filtro && socios ? socios.filter(s => s.nombreCompleto.toLowerCase().includes(filtro) || s.dni.includes(filtro)).slice(0, 6) : [];

  const guardar = async (e) => {
    e.preventDefault();
    setProcesando(true);
    setError('');
    try {
      onCreada(await crearTarea({ idSocio: socio.idSocio, descripcion: datos.descripcion.trim(), vence: datos.vence }));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Modal titulo="Nueva tarea" subtitulo="Algo que hay que hacer con un socio" onClose={onClose}
      pie={<>
        <button type="button" onClick={onClose} className={botonSecundario}>Cancelar</button>
        <button type="submit" form="form-tarea" disabled={procesando || !socio} className={botonPrimario}>
          <Plus className="w-4 h-4" /> {procesando ? 'Guardando...' : 'Crear tarea'}
        </button>
      </>}>
      <form id="form-tarea" onSubmit={guardar} className="space-y-3">
        <Campo label="Socio" required>
          {socio ? (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-sm">
              <span className="font-semibold text-slate-800">{socio.nombreCompleto} <span className="font-normal text-slate-500">· DNI {socio.dni}</span></span>
              <button type="button" onClick={() => setSocio(null)} className="text-slate-500 hover:text-slate-600" aria-label="Elegir otro socio"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <>
              <input autoFocus value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscá por nombre o DNI" className={inputClass} />
              {resultados.length > 0 && (
                <ul className="mt-1 border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {resultados.map(s => (
                    <li key={s.idSocio}>
                      <button type="button" onClick={() => setSocio(s)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50">
                        {s.nombreCompleto} <span className="text-slate-500">· DNI {s.dni}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Campo>
        <Campo label="Qué hay que hacer" required>
          <input required minLength={3} maxLength={300} value={datos.descripcion} placeholder="Ej. llamarlo para ofrecerle el plan libre"
            onChange={e => setDatos(d => ({ ...d, descripcion: e.target.value }))} className={inputClass} />
        </Campo>
        <Campo label="Para cuándo">
          <input type="date" min={hoyIso()} value={datos.vence} onChange={e => setDatos(d => ({ ...d, vence: e.target.value }))} className={inputClass} />
        </Campo>
        {error && <p className="text-sm text-rose-700 font-medium">{error}</p>}
      </form>
    </Modal>
  );
};

/**
 * Tareas de seguimiento: a quién hay que contactar y por qué (cuota por vencer o vencida, apto por vencer, socio que no
 * viene, o lo que cargue el equipo). Las automáticas se generan solas y se resuelven solas cuando el socio renueva,
 * trae el apto o vuelve. Cada una tiene su mensaje de WhatsApp listo.
 */
const TareasCRM = () => {
  const [vista, setVista] = useState('pendientes');
  const [tareas, setTareas] = useState(null);
  const [tipo, setTipo] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [gimnasio, setGimnasio] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [resolviendo, setResolviendo] = useState(null); // { idTarea, canal, nota, enviando, error }

  const cargar = useCallback(async (generar = false) => {
    setCargando(true);
    try {
      if (generar) await generarTareas();
      setTareas(await listarTareas(vista));
      setError('');
      actualizarTareasPendientes();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [vista]);

  // Al entrar se generan las tareas del momento (además se generan solas cada hora)
  useEffect(() => { cargar(vista === 'pendientes'); }, [cargar, vista]);
  useEffect(() => { datosDelGimnasio().then(g => setGimnasio(g?.nombre || null)); }, []);

  const resolver = async (tarea, estado) => {
    const pedido = estado === 'HECHA'
      ? { estado, canal: resolviendo.canal, nota: resolviendo.nota.trim() || null }
      : { estado };
    if (estado === 'HECHA') setResolviendo(r => ({ ...r, enviando: true, error: '' }));
    try {
      await resolverTarea(tarea.idTarea, pedido);
      setResolviendo(null);
      cargar();
    } catch (err) {
      if (estado === 'HECHA') setResolviendo(r => ({ ...r, enviando: false, error: err.message }));
      else setError(err.message);
    }
  };

  const filtro = busqueda.trim().toLowerCase();
  const visibles = (tareas || []).filter(t => (!tipo || t.tipo === tipo)
    && (!filtro || t.nombreSocio.toLowerCase().includes(filtro) || t.dniSocio.includes(filtro) || t.descripcion.toLowerCase().includes(filtro)));
  const atrasadas = vista === 'pendientes' ? (tareas || []).filter(t => diasHasta(t.vence) < 0).length : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" /> Tareas de seguimiento
          </h1>
          <p className="text-sm text-slate-500 mt-1">A quién hay que contactar y por qué. Las automáticas se cierran solas cuando el socio renueva, trae el apto o vuelve.</p>
          {vista === 'pendientes' && tareas && (
            <p className="text-xs text-slate-500 mt-2">
              {tareas.length} {tareas.length === 1 ? 'pendiente' : 'pendientes'}
              {atrasadas > 0 ? ` · ${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => cargar(true)} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 bg-white">
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          <button onClick={() => setNueva(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-xs">
            <Plus className="w-4 h-4" /> Nueva tarea
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 pt-3 border-b border-slate-200 flex gap-1" role="tablist">
          {[['pendientes', 'Pendientes'], ['resueltas', 'Resueltas']].map(([id, texto]) => (
            <button key={id} role="tab" aria-selected={vista === id} onClick={() => { setVista(id); setResolviendo(null); }}
              className={`px-3 py-1.5 text-sm font-semibold border-b-2 -mb-px ${vista === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {texto}
            </button>
          ))}
        </div>
        <div className="p-3 border-b border-slate-200 flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTipo(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${!tipo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>Todas</button>
            {Object.entries(TIPOS_TAREA).map(([clave, t]) => (
              <button key={clave} onClick={() => setTipo(clave)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${tipo === clave ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                {t.texto}
              </button>
            ))}
          </div>
          <div className="relative md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por socio o tarea..."
              className="pl-8 pr-3 py-1.5 w-full border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>

        {tareas && visibles.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            {tareas.length === 0
              ? (vista === 'pendientes' ? '¡Todo al día! No hay socios para contactar por ahora.' : 'Todavía no hay tareas resueltas.')
              : 'Ninguna tarea coincide con el filtro.'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibles.map(t => {
              const tipoTarea = TIPOS_TAREA[t.tipo] || TIPOS_TAREA.MANUAL;
              const vence = textoVence(t.vence);
              const estado = ESTADOS_RESUELTA[t.estado];
              return (
                <li key={t.idTarea} className="p-3 sm:px-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${tipoTarea.clase}`}>{tipoTarea.texto}</span>
                        <span className="font-semibold text-slate-800">{t.nombreSocio}</span>
                        <span className="text-xs text-slate-500">DNI {t.dniSocio}{t.telefonoSocio ? ` · ${t.telefonoSocio}` : ''}</span>
                      </div>
                      <p className="text-sm text-slate-700 mt-1">{t.descripcion}</p>
                      {vista === 'pendientes' ? (
                        <p className={`text-xs mt-1 font-medium ${vence.clase}`}>{vence.texto}{t.creadaPor ? ` · cargada por ${t.creadaPor}` : ''}</p>
                      ) : (
                        <p className="text-xs mt-1 text-slate-500">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-sm border text-xs font-semibold mr-1.5 ${estado?.clase}`}>{estado?.texto}</span>
                          {t.canal ? `${textoCanal(t.canal)} · ` : ''}{t.fechaResolucion ? formatFechaHora(t.fechaResolucion) : ''}
                          {t.resueltaPor ? ` · ${t.resueltaPor}` : ''}{t.nota ? ` · ${t.nota}` : ''}
                        </p>
                      )}
                    </div>
                    {vista === 'pendientes' && resolviendo?.idTarea !== t.idTarea && (
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <a href={enlaceWhatsApp(t.telefonoSocio, mensajeTarea(t, gimnasio))} target="_blank" rel="noopener noreferrer"
                          onClick={() => setResolviendo({ idTarea: t.idTarea, canal: 'WHATSAPP', nota: '', enviando: false, error: '' })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                        <button onClick={() => setResolviendo({ idTarea: t.idTarea, canal: 'LLAMADA', nota: '', enviando: false, error: '' })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold">
                          <Check className="w-3.5 h-3.5" /> Hecha
                        </button>
                        <button onClick={() => resolver(t, 'DESCARTADA')} title="No hace falta hacerla"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold">
                          <X className="w-3.5 h-3.5" /> Descartar
                        </button>
                      </div>
                    )}
                  </div>
                  {resolviendo?.idTarea === t.idTarea && (
                    <div className="mt-2 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">¿Cómo lo contactaste?</span>
                        <select value={resolviendo.canal} onChange={e => setResolviendo(r => ({ ...r, canal: e.target.value }))}
                          className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white" aria-label="Canal">
                          {CANALES.map(c => <option key={c.valor} value={c.valor}>{c.texto}</option>)}
                        </select>
                        <input value={resolviendo.nota} maxLength={300} placeholder="¿Qué te dijo? (opcional)"
                          onChange={e => setResolviendo(r => ({ ...r, nota: e.target.value }))}
                          className="flex-1 min-w-48 px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white" />
                        <button onClick={() => resolver(t, 'HECHA')} disabled={resolviendo.enviando}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50">
                          {resolviendo.enviando ? 'Guardando...' : 'Marcar como hecha'}
                        </button>
                        <button onClick={() => setResolviendo(null)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold bg-white">
                          Todavía no
                        </button>
                      </div>
                      {resolviendo.error && <p className="text-xs text-rose-700 font-medium mt-1">{resolviendo.error}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {nueva && <NuevaTareaModal onClose={() => setNueva(false)} onCreada={() => { setNueva(false); setVista('pendientes'); cargar(); }} />}
    </div>
  );
};

export default TareasCRM;
