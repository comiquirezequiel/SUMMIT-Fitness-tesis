// React: useState guarda datos que, al cambiar, vuelven a dibujar el componente; useEffect ejecuta código
// después de dibujar (consultas, temporizadores) y permite limpiarlo al salir de la pantalla.
import React, { useEffect, useState } from 'react';
// Íconos de la librería lucide-react (Sparkles = el ícono "✦" que identifica todo lo que hace la IA).
import { Sparkles, Loader2, CheckCircle2, XCircle, HelpCircle, Info, AlertTriangle } from 'lucide-react';
import { estadoIa } from '../../services/ia';
import { formatFecha } from '../../utils/formato';

// Piezas del asistente de IA local (Ollama) que comparten el alta de socio, la ficha y el constructor
// Se agrupan en un solo archivo para que las tres pantallas muestren la IA exactamente igual (mismo botón,
// misma tarjeta, mismos avisos) y cualquier cambio visual se haga una sola vez.

// Estado del asistente: null mientras se consulta, después { disponible, modelo, motivo }
// Es un "hook" propio (función que empieza con "use"): encapsula la consulta para reutilizarla en cualquier pantalla.
export const useEstadoIa = () => {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    // "vigente" evita actualizar el estado si el usuario ya salió de la pantalla antes de que llegue la respuesta
    // (React avisaría de un componente desmontado).
    let vigente = true;
    estadoIa().then(e => { if (vigente) setEstado(e); });
    return () => { vigente = false; };   // limpieza al desmontar
  }, []);                                // [] = se ejecuta una sola vez, al abrir la pantalla
  return estado;
};

// Segundos desde que arrancó el análisis (el modelo local tarda entre 20 s y 1 min)
// Mostrar los segundos evita que el usuario piense que la página se colgó durante la espera.
const useCronometro = (activo) => {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    if (!activo) return undefined;
    setSegundos(0);
    // setInterval suma 1 cada 1000 ms; clearInterval lo detiene cuando termina el análisis o se cierra la pantalla.
    const id = setInterval(() => setSegundos(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [activo]);                          // se reinicia cada vez que cambia "activo"
  return segundos;
};

/**
 * Botón violeta de la IA (el color violeta identifica en toda la app lo que hace el asistente).
 * - Deshabilitado si está analizando o si la IA no está disponible.
 * - El "title" (texto al pasar el mouse) explica por qué no está disponible (ej. "Ollama no está corriendo").
 * - Mientras analiza, muestra un ícono girando y el cronómetro.
 * "children" es el texto que pone cada pantalla (ej. "Leer el certificado con IA").
 */
export const BotonIa = ({ onClick, cargando, estado, children, className = '' }) => {
  const segundos = useCronometro(cargando);
  // "?." (encadenamiento opcional): si estado todavía es null, no falla, devuelve undefined.
  const disponible = estado?.disponible;
  return (
    <button type="button" onClick={onClick} disabled={cargando || !disponible}
      title={disponible === false ? `Asistente de IA no disponible: ${estado.motivo}` : 'Lo analiza un modelo de IA que corre en este equipo'}
      className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors
        border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}>
      {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      {cargando ? `Analizando… ${segundos} s` : children}
    </button>
  );
};

// Aviso cuando Ollama no está corriendo (en lugar de esconder la función sin explicar por qué)
// Solo se muestra cuando ya se sabe que NO está disponible (estado existe y disponible es false).
export const AvisoIaNoDisponible = ({ estado }) => (estado && !estado.disponible ? (
  <p className="text-xs text-slate-500 flex items-start gap-1.5">
    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
    Asistente de IA no disponible: {estado.motivo}.
  </p>
) : null);

// El resultado "apto" tiene tres valores posibles: true (apto), false (no apto) y null (el certificado no lo dice).
const Apto = ({ apto }) => {
  if (apto === true) return <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Apto</span>;
  if (apto === false) return <span className="inline-flex items-center gap-1 text-rose-700"><XCircle className="w-4 h-4" /> No apto</span>;
  return <span className="inline-flex items-center gap-1 text-slate-500"><HelpCircle className="w-4 h-4" /> No lo indica</span>;
};

/**
 * Lo que la IA leyó en el certificado, para revisar antes de usarlo.
 * acciones: botones que decide quien lo usa (ej. "Usar estos datos" / "Descartar").
 *
 * Recibe el AnalisisCertificadoDTO del backend tal cual. El orden de la tarjeta es intencional:
 * 1) advertencias en rojo arriba (lo más importante: otra persona, no apto, vencido);
 * 2) de quién es el certificado; 3) apto y fecha; 4) patologías; 5) indicaciones; 6) resumen;
 * 7) el aviso de que la IA puede equivocarse; 8) los botones de la pantalla que la usa.
 */
export const ResultadoAnalisis = ({ analisis, acciones }) => (
  <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-semibold text-violet-800 flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Lectura del asistente de IA</p>
      {/* Cómo se leyó (texto o imagen), qué modelo lo hizo y cuánto tardó: transparencia para el usuario. */}
      <p className="text-xs text-slate-500">
        {analisis.fuente === 'TEXTO_PDF' ? 'Texto del PDF' : analisis.fuente === 'PDF_ESCANEADO' ? 'PDF escaneado' : 'Imagen'}
        {' · '}{analisis.modelo} · {analisis.segundos} s
      </p>
    </div>
    {/* Advertencias calculadas por el backend (no por la IA). "?." por si el campo no viniera. */}
    {analisis.advertencias?.length > 0 && (
      <ul className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 space-y-1 text-rose-800 font-medium">
        {analisis.advertencias.map(a => (
          <li key={a} className="flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {a}</li>
        ))}
      </ul>
    )}
    {/* Nombre y DNI leídos: permiten comparar a simple vista con el socio. */}
    {(analisis.pacienteNombre || analisis.pacienteDni) && (
      <p className="text-xs text-slate-500">
        Certificado de <b className="text-slate-700">{analisis.pacienteNombre || 'nombre no legible'}</b>
        {analisis.pacienteDni && <> · DNI {analisis.pacienteDni}</>}
      </p>
    )}
    <div className="grid grid-cols-2 gap-3">
      <div><p className="text-xs text-slate-500">Resultado</p><p className="font-semibold"><Apto apto={analisis.apto} /></p></div>
      <div><p className="text-xs text-slate-500">Fecha de emisión</p>
        <p className="font-semibold text-slate-800">{analisis.fechaEmision ? formatFecha(analisis.fechaEmision) : 'No se pudo leer'}</p></div>
    </div>
    <div>
      <p className="text-xs text-slate-500 mb-1">Patologías</p>
      {/* "key" identifica cada elemento de una lista para que React actualice solo lo que cambia. */}
      {analisis.patologias.length === 0
        ? <p className="text-slate-600">No menciona ninguna</p>
        : <div className="flex flex-wrap gap-1.5">{analisis.patologias.map(p => (
          <span key={p} className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{p}</span>))}</div>}
    </div>
    {analisis.restricciones.length > 0 && (
      <div>
        <p className="text-xs text-slate-500 mb-1">Indicaciones del médico</p>
        <ul className="list-disc pl-5 text-slate-700 space-y-0.5">{analisis.restricciones.map(r => <li key={r}>{r}</li>)}</ul>
      </div>
    )}
    {analisis.resumen && (
      <div>
        <p className="text-xs text-slate-500 mb-1">Resumen para el profesor</p>
        <p className="text-slate-700">{analisis.resumen}</p>
      </div>
    )}
    {/* Aviso permanente: recuerda que es una propuesta y que la decisión es de la persona. */}
    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
      Lo propone la IA y puede equivocarse: comparalo con el certificado antes de guardarlo.
    </p>
    {acciones && <div className="flex flex-wrap justify-end gap-2">{acciones}</div>}
  </div>
);
