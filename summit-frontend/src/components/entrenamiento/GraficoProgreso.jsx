import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Table2, LineChart } from 'lucide-react';
import { formatFecha } from '../../utils/formato';
import { fechaCorta, formatNumero, seriesPorReps } from './comun';

// Colores de los datos (validados para daltonismo y contraste sobre blanco). Los grises (grilla, ejes y textos) y
// el fondo van con clases de Tailwind: en la app del socio se adaptan solos al modo oscuro (index.css), en el panel
// son los mismos de siempre.
const AZUL = '#2563eb';
const NARANJA = '#ea580c';
const NARANJA_OSCURO = '#9a3412';

// Geometría: dos paneles que comparten el eje de fechas (nunca dos escalas en el mismo panel)
const ML = 46;
const MR = 16;
const T1 = 24;
const B1 = 190;
const T2 = B1 + 46;
const B2 = T2 + 90;
const ALTO = B2 + 30;
const ANCHO_TOOLTIP = 176;
const AIRE_X = 14; // las barras de los extremos no tapan el eje

// 'YYYY-MM-DD' -> número de día, para ubicar las fechas en el tiempo real (se ven los huecos)
const aDia = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86400000;
};

// Límites y marcas redondas para un eje
const escala = (min, max, marcas = 4) => {
  let desde = min;
  let hasta = max;
  if (desde === hasta) {
    const margen = Math.max(1, Math.abs(desde) * 0.1);
    desde -= margen;
    hasta += margen;
  }
  const crudo = (hasta - desde) / marcas;
  const magnitud = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * magnitud).find((p) => p >= crudo);
  const inicio = Math.floor(desde / paso) * paso;
  const fin = Math.ceil(hasta / paso) * paso;
  const ticks = [];
  for (let v = inicio; v <= fin + paso / 2; v += paso) ticks.push(Number(v.toFixed(6)));
  return { desde: inicio, hasta: fin, ticks };
};

// Barra con las puntas de arriba redondeadas, apoyada en la base
const barra = (x, ancho, y, base) => {
  const r = Math.min(4, ancho / 2, Math.max(0, base - y));
  const izq = x - ancho / 2;
  const der = x + ancho / 2;
  return `M${izq},${base} L${izq},${y + r} Q${izq},${y} ${izq + r},${y} L${der - r},${y} Q${der},${y} ${der},${y + r} L${der},${base} Z`;
};

const METRICAS_INFERIORES = {
  rpe: { titulo: 'RPE (esfuerzo percibido, 1 a 10)', corto: 'RPE' },
  volumenKg: { titulo: 'Volumen (kg = peso × reps × series)', corto: 'Volumen' },
};

/**
 * Gráfico de progreso de un ejercicio en SVG propio (sin librerías), de ancho 100%.
 * Arriba: línea de peso por fecha (repeticiones si el ejercicio es con el peso del cuerpo).
 * Abajo, con la misma escala de fechas: barras de RPE o de volumen.
 * Al pasar el mouse (o tocar en el celular) muestra el detalle de cada registro; también hay vista de tabla.
 * datos: [{fecha, pesoKg, repeticiones, series, rpe, volumenKg}] del más viejo al más nuevo.
 */
const GraficoProgreso = ({ datos, nombreEjercicio }) => {
  const contenedorRef = useRef(null);
  const [ancho, setAncho] = useState(0);
  const [activo, setActivo] = useState(null);
  const [inferior, setInferior] = useState('rpe');
  const [verTabla, setVerTabla] = useState(false);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return undefined;
    const medir = () => setAncho(el.clientWidth);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [verTabla]);

  useEffect(() => { setActivo(null); }, [datos]);

  const usaPeso = datos.some((d) => d.pesoKg !== null && d.pesoKg !== undefined);
  const hayVolumen = datos.some((d) => d.volumenKg > 0);
  const metricaInferior = hayVolumen ? inferior : 'rpe';
  const principal = usaPeso
    ? { campo: 'pesoKg', titulo: 'Peso levantado (kg)', formato: (v) => `${formatNumero(v)} kg` }
    : { campo: 'repeticiones', titulo: 'Repeticiones (ejercicio con el peso del cuerpo)', formato: (v) => `${formatNumero(v, 0)} reps` };

  const valores = useMemo(
    () => datos.map((d) => d[principal.campo]).filter((v) => v !== null && v !== undefined),
    [datos, principal.campo],
  );

  // Resumen: primer registro, último, variación y mejor marca
  const resumen = useMemo(() => {
    const conValor = datos.filter((d) => d[principal.campo] !== null && d[principal.campo] !== undefined);
    if (conValor.length === 0) return null;
    const primero = conValor[0];
    const ultimo = conValor[conValor.length - 1];
    const mejor = conValor.reduce((m, d) => (d[principal.campo] > m[principal.campo] ? d : m), conValor[0]);
    const diferencia = ultimo[principal.campo] - primero[principal.campo];
    const porcentaje = primero[principal.campo] > 0 ? Math.round((diferencia / primero[principal.campo]) * 100) : null;
    return { primero, ultimo, mejor, diferencia, porcentaje };
  }, [datos, principal.campo]);

  const geo = useMemo(() => {
    if (ancho === 0 || datos.length === 0) return null;
    const anchoPlot = Math.max(ancho - ML - MR - 2 * AIRE_X, 40);
    const dias = datos.map((d) => aDia(d.fecha));
    const d0 = Math.min(...dias);
    const d1 = Math.max(...dias);
    const x = (dia) => ML + AIRE_X + (d1 === d0 ? anchoPlot / 2 : ((dia - d0) / (d1 - d0)) * anchoPlot);
    const xs = dias.map(x);

    // Panel superior (con un poco de aire arriba y abajo para las etiquetas)
    const min = valores.length ? Math.min(...valores) : 0;
    const max = valores.length ? Math.max(...valores) : 1;
    const aire = (max - min) * 0.08;
    const e1 = escala(Math.max(0, min - aire), max + aire, 4);
    const y1 = (v) => B1 - ((v - e1.desde) / (e1.hasta - e1.desde)) * (B1 - T1);

    // Panel inferior
    const valoresInf = datos.map((d) => d[metricaInferior] || 0);
    const e2 = metricaInferior === 'rpe'
      ? { desde: 0, hasta: 10, ticks: [0, 5, 10] }
      : escala(0, Math.max(...valoresInf, 1), 3);
    const y2 = (v) => B2 - ((v - e2.desde) / (e2.hasta - e2.desde)) * (B2 - T2);

    // Ancho de barra: deja al menos 2 px entre barras vecinas
    const unicos = [...new Set(xs)].sort((a, b) => a - b);
    let separacion = Infinity;
    for (let i = 1; i < unicos.length; i++) separacion = Math.min(separacion, unicos[i] - unicos[i - 1]);
    const anchoBarra = Math.max(3, Math.min(18, (separacion === Infinity ? 18 : separacion) - 2));

    // Línea por tramos (se corta si un registro no tiene valor)
    let camino = '';
    let abierto = false;
    datos.forEach((d, i) => {
      const v = d[principal.campo];
      if (v === null || v === undefined) { abierto = false; return; }
      camino += `${abierto ? 'L' : 'M'}${xs[i].toFixed(1)},${y1(v).toFixed(1)} `;
      abierto = true;
    });

    // Fechas del eje: las de los registros, sin que se pisen (la última siempre)
    const etiquetasX = [];
    const distanciaMinima = 62;
    unicos.forEach((px) => {
      const anterior = etiquetasX[etiquetasX.length - 1];
      if (anterior === undefined || px - anterior >= distanciaMinima) etiquetasX.push(px);
    });
    const ultimoX = unicos[unicos.length - 1];
    if (etiquetasX[etiquetasX.length - 1] !== ultimoX) {
      if (ultimoX - etiquetasX[etiquetasX.length - 1] < distanciaMinima) etiquetasX.pop();
      etiquetasX.push(ultimoX);
    }
    const fechaDeX = new Map(xs.map((px, i) => [px, datos[i].fecha]));

    // Etiquetas directas: último registro y mejor marca (si no se pisan)
    const indices = datos.map((d, i) => i).filter((i) => datos[i][principal.campo] !== null && datos[i][principal.campo] !== undefined);
    const etiquetas = [];
    if (indices.length) {
      const iUltimo = indices[indices.length - 1];
      const iMejor = indices.reduce((m, i) => (datos[i][principal.campo] > datos[m][principal.campo] ? i : m), indices[0]);
      etiquetas.push(iUltimo);
      if (iMejor !== iUltimo && Math.abs(xs[iMejor] - xs[iUltimo]) > 56) etiquetas.push(iMejor);
    }

    return { anchoPlot, xs, e1, y1, e2, y2, anchoBarra, camino, etiquetasX, fechaDeX, etiquetas };
  }, [ancho, datos, valores, metricaInferior, principal.campo]);

  if (datos.length === 0) return null;

  const mover = (e) => {
    if (!geo) return;
    const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let mejor = 0;
    geo.xs.forEach((x, i) => { if (Math.abs(x - px) < Math.abs(geo.xs[mejor] - px)) mejor = i; });
    setActivo(mejor);
  };

  const teclas = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setActivo((i) => (i === null ? 0 : Math.min(i + 1, datos.length - 1))); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActivo((i) => (i === null ? datos.length - 1 : Math.max(i - 1, 0))); }
    if (e.key === 'Escape') setActivo(null);
  };

  const anclaje = (x) => (x > ancho - MR - 28 ? 'end' : x < ML + 28 ? 'start' : 'middle');
  const punto = activo !== null ? datos[activo] : null;
  const xActivo = activo !== null && geo ? geo.xs[activo] : 0;
  const izquierdaTooltip = xActivo + 14 + ANCHO_TOOLTIP > ancho ? Math.max(4, xActivo - 14 - ANCHO_TOOLTIP) : xActivo + 14;

  const descripcion = resumen
    ? `${principal.titulo} en ${nombreEjercicio}: de ${principal.formato(resumen.primero[principal.campo])} el ${formatFecha(resumen.primero.fecha)} `
      + `a ${principal.formato(resumen.ultimo[principal.campo])} el ${formatFecha(resumen.ultimo.fecha)}, ${datos.length} registros.`
    : `Progreso de ${nombreEjercicio}`;

  return (
    <div className="space-y-4">
      {resumen && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <dt className="text-xs text-slate-500">Primer registro</dt>
            <dd className="font-bold text-slate-800">{principal.formato(resumen.primero[principal.campo])}</dd>
            <dd className="text-xs text-slate-400">{formatFecha(resumen.primero.fecha)}</dd>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <dt className="text-xs text-slate-500">Último registro</dt>
            <dd className="font-bold text-slate-800">{principal.formato(resumen.ultimo[principal.campo])}</dd>
            <dd className="text-xs text-slate-400">{formatFecha(resumen.ultimo.fecha)}</dd>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <dt className="text-xs text-slate-500">Variación</dt>
            <dd className={`font-bold ${resumen.diferencia > 0 ? 'text-emerald-700' : resumen.diferencia < 0 ? 'text-rose-700' : 'text-slate-800'}`}>
              {resumen.diferencia > 0 ? '+' : resumen.diferencia < 0 ? '−' : ''}{principal.formato(Math.abs(resumen.diferencia))}
            </dd>
            <dd className="text-xs text-slate-400">{resumen.porcentaje !== null ? `${resumen.porcentaje > 0 ? '+' : ''}${resumen.porcentaje} % desde el inicio` : 'desde el inicio'}</dd>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <dt className="text-xs text-slate-500">Mejor marca</dt>
            <dd className="font-bold text-slate-800">{principal.formato(resumen.mejor[principal.campo])}</dd>
            <dd className="text-xs text-slate-400">{formatFecha(resumen.mejor.fecha)}</dd>
          </div>
        </dl>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{principal.titulo}</p>
        <div className="flex items-center gap-2">
          {!verTabla && hayVolumen && (
            <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50" role="group" aria-label="Medida del gráfico de barras">
              {Object.entries(METRICAS_INFERIORES).map(([clave, m]) => (
                <button key={clave} onClick={() => setInferior(clave)} aria-pressed={metricaInferior === clave}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md ${metricaInferior === clave ? 'bg-superficie shadow-sm text-slate-800' : 'text-slate-500'}`}>
                  {m.corto}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setVerTabla((v) => !v)}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
            {verTabla ? <><LineChart className="w-3.5 h-3.5" /> Ver gráfico</> : <><Table2 className="w-3.5 h-3.5" /> Ver tabla</>}
          </button>
        </div>
      </div>

      {verTabla ? (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium text-right">Peso</th>
                <th className="px-3 py-2 font-medium text-right">Series × reps</th>
                <th className="px-3 py-2 font-medium text-right">RPE</th>
                <th className="px-3 py-2 font-medium text-right">Volumen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...datos].reverse().map((d, i) => (
                <tr key={`${d.fecha}-${i}`}>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{formatFecha(d.fecha)}</td>
                  <td className="px-3 py-2 text-right text-slate-700 whitespace-nowrap">{d.pesoKg !== null && d.pesoKg !== undefined ? `${formatNumero(d.pesoKg)} kg` : 'Peso corporal'}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{seriesPorReps(d.series, d.repeticiones)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{d.rpe ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-700 whitespace-nowrap">{d.volumenKg ? `${formatNumero(d.volumenKg, 0)} kg` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={contenedorRef} className="relative w-full select-none">
          {geo && (
            <svg width={ancho} height={ALTO} role="img" aria-label={descripcion} tabIndex={0} onKeyDown={teclas}
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 rounded-lg">
              {/* Panel superior: grilla y eje */}
              {geo.e1.ticks.map((t) => (
                <g key={`t1-${t}`}>
                  <line x1={ML} x2={ancho - MR} y1={geo.y1(t)} y2={geo.y1(t)} className={t === geo.e1.desde ? 'stroke-slate-300' : 'stroke-slate-100'} strokeWidth="1" />
                  <text x={ML - 8} y={geo.y1(t)} dy="0.32em" textAnchor="end" fontSize="11" className="fill-slate-500">{formatNumero(t)}</text>
                </g>
              ))}
              {geo.camino && <path d={geo.camino} fill="none" stroke={AZUL} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
              {datos.map((d, i) => {
                const v = d[principal.campo];
                if (v === null || v === undefined) return null;
                return (
                  <circle key={`p-${i}`} cx={geo.xs[i]} cy={geo.y1(v)} r={activo === i ? 6 : 4}
                    fill={AZUL} className="stroke-superficie" strokeWidth="2" />
                );
              })}
              {geo.etiquetas.map((i) => (
                <text key={`e-${i}`} x={geo.xs[i]} y={geo.y1(datos[i][principal.campo]) - 11} textAnchor={anclaje(geo.xs[i])}
                  fontSize="11" fontWeight="600" className="fill-slate-700 stroke-superficie" strokeWidth="3" style={{ paintOrder: 'stroke' }}>
                  {principal.formato(datos[i][principal.campo])}
                </text>
              ))}

              {/* Panel inferior: RPE o volumen, misma escala de fechas */}
              <text x={4} y={T2 - 16} fontSize="12" fontWeight="600" className="fill-slate-700">{METRICAS_INFERIORES[metricaInferior].titulo}</text>
              {geo.e2.ticks.map((t) => (
                <g key={`t2-${t}`}>
                  <line x1={ML} x2={ancho - MR} y1={geo.y2(t)} y2={geo.y2(t)} className={t === 0 ? 'stroke-slate-300' : 'stroke-slate-100'} strokeWidth="1" />
                  <text x={ML - 8} y={geo.y2(t)} dy="0.32em" textAnchor="end" fontSize="11" className="fill-slate-500">{formatNumero(t, 0)}</text>
                </g>
              ))}
              {datos.map((d, i) => {
                const v = d[metricaInferior];
                if (!v) return null;
                return (
                  <path key={`b-${i}`} d={barra(geo.xs[i], geo.anchoBarra, geo.y2(v), B2)}
                    fill={activo === i ? NARANJA_OSCURO : NARANJA} />
                );
              })}

              {/* Eje de fechas compartido */}
              {geo.etiquetasX.map((px) => (
                <text key={`x-${px}`} x={px} y={B2 + 18} textAnchor={anclaje(px)} fontSize="11" className="fill-slate-500">
                  {fechaCorta(geo.fechaDeX.get(px)).split(' ')[1]}
                </text>
              ))}

              {/* Guía del registro elegido */}
              {punto && (
                <line x1={xActivo} x2={xActivo} y1={T1 - 8} y2={B2} className="stroke-slate-400" strokeWidth="1" strokeDasharray="3 3" pointerEvents="none" />
              )}

              {/* Zona sensible (más grande que las marcas) para mouse y dedo */}
              <rect x={ML - 10} y={0} width={Math.max(ancho - ML - MR + 20, 0)} height={B2 + 4} fill="transparent"
                style={{ touchAction: 'pan-y', cursor: 'crosshair' }}
                onPointerMove={mover} onPointerDown={mover}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActivo(null); }} />
            </svg>
          )}

          {punto && (
            <div className="absolute pointer-events-none bg-superficie/95 border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-xs text-slate-600 space-y-0.5"
              style={{ left: izquierdaTooltip, top: T1, width: ANCHO_TOOLTIP }} role="status">
              <p className="font-semibold text-slate-800">{fechaCorta(punto.fecha)}/{punto.fecha.substring(0, 4)}</p>
              <p className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: AZUL }} />
                Peso: <b className="text-slate-800">{punto.pesoKg !== null && punto.pesoKg !== undefined ? `${formatNumero(punto.pesoKg)} kg` : 'Peso corporal'}</b>
              </p>
              <p>Series × reps: <b className="text-slate-800">{seriesPorReps(punto.series, punto.repeticiones)}</b></p>
              <p className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: NARANJA }} />
                RPE: <b className="text-slate-800">{punto.rpe ?? '—'}</b>
                {hayVolumen && <> · Vol.: <b className="text-slate-800">{punto.volumenKg ? `${formatNumero(punto.volumenKg, 0)} kg` : '—'}</b></>}
              </p>
            </div>
          )}
        </div>
      )}

      {datos.length === 1 && (
        <p className="text-xs text-slate-500">Hay un solo registro: con el próximo entrenamiento ya se ve la evolución.</p>
      )}
      {!verTabla && <p className="text-xs text-slate-400">Pasá el mouse o tocá el gráfico para ver cada registro.</p>}
    </div>
  );
};

export default GraficoProgreso;
