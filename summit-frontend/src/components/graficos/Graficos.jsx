import { useState } from 'react';
import {
  SERIES, TINTA, GRILLA, BASE, GRIS_ENFASIS, RAMPA, CERO,
  numero, compacto, etiquetaFecha, fechaLarga, escala, useAncho, Tooltip,
} from './base';

/*
 * Gráficos en SVG propio (sin librerías): marcas finas, extremos redondeados de 4px apoyados en la línea base,
 * grilla tenue de 1px, etiquetas selectivas y tooltip al pasar el mouse o con el teclado (Tab y flechas).
 */

const texto = { fontSize: 11, fill: TINTA.tenue };
const cifras = { fontVariantNumeric: 'tabular-nums' };

// Barra horizontal: recta en la base (izquierda), redondeada en la punta
const barraHorizontal = (x, y, largo, grosor, r = 4) => {
  const rr = Math.min(r, largo, grosor / 2);
  return `M${x},${y} H${x + largo - rr} Q${x + largo},${y} ${x + largo},${y + rr} V${y + grosor - rr} Q${x + largo},${y + grosor} ${x + largo - rr},${y + grosor} H${x} Z`;
};

// Columna: recta en la base, redondeada arriba
const columna = (x, base, alto, grosor, r = 4) => {
  const rr = Math.min(r, alto, grosor / 2);
  const y = base - alto;
  return `M${x},${base} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + grosor - rr} Q${x + grosor},${y} ${x + grosor},${y + rr} V${base} Z`;
};

/**
 * Evolución en el tiempo de una sola serie (área suave + línea de 2px), con crosshair que sigue al puntero.
 */
export const GraficoLinea = ({ datos, alto = 260, color = SERIES[0], formatoValor = numero, formatoEje = compacto, descripcion }) => {
  const [ref, ancho] = useAncho();
  const [activo, setActivo] = useState(null);
  const m = { arriba: 14, derecha: 52, abajo: 26, izquierda: 44 };
  const w = Math.max(1, ancho - m.izquierda - m.derecha);
  const h = alto - m.arriba - m.abajo;
  const { max, ticks } = escala(Math.max(0, ...datos.map(d => d.valor)));
  const x = (i) => m.izquierda + (datos.length <= 1 ? w / 2 : (i * w) / (datos.length - 1));
  const y = (v) => m.arriba + h - (v / max) * h;
  const ultimo = datos.length - 1;
  const linea = datos.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.valor)}`).join(' ');
  const area = `${linea} L${x(ultimo)},${y(0)} L${x(0)},${y(0)} Z`;

  // Etiquetas del eje X cada tanto, contadas desde el final (la última fecha siempre se ve)
  const paso = Math.max(1, Math.ceil(datos.length / Math.max(2, Math.floor(w / 70))));
  const etiquetasX = [];
  for (let i = ultimo; i >= 0; i -= paso) etiquetasX.push(i);

  const mover = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - m.izquierda) / w) * ultimo);
    setActivo(Math.min(ultimo, Math.max(0, i)));
  };
  const teclado = (e) => {
    if (e.key === 'ArrowRight') setActivo(a => Math.min(ultimo, (a ?? -1) + 1));
    if (e.key === 'ArrowLeft') setActivo(a => Math.max(0, (a ?? ultimo + 1) - 1));
  };

  return (
    <div ref={ref} className="relative" style={{ height: alto }}>
      {ancho > 0 && datos.length > 0 && (
        <svg width={ancho} height={alto} role="img" aria-label={descripcion} tabIndex={0}
          className="outline-hidden focus-visible:ring-2 focus-visible:ring-blue-200 rounded-sm"
          onPointerMove={mover} onPointerLeave={() => setActivo(null)}
          onFocus={() => setActivo(ultimo)} onBlur={() => setActivo(null)} onKeyDown={teclado}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={m.izquierda} x2={ancho - m.derecha} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASE : GRILLA} />
              <text x={m.izquierda - 8} y={y(t)} dy="0.32em" textAnchor="end" style={{ ...texto, ...cifras }}>{formatoEje(t)}</text>
            </g>
          ))}
          {etiquetasX.map(i => (
            <text key={i} x={x(i)} y={alto - 6} textAnchor={i === ultimo ? 'end' : i === 0 ? 'start' : 'middle'} style={texto}>
              {etiquetaFecha(datos[i].clave)}
            </text>
          ))}
          <path d={area} fill={color} fillOpacity="0.1" />
          <path d={linea} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {/* Etiqueta directa solo en el último punto */}
          <circle cx={x(ultimo)} cy={y(datos[ultimo].valor)} r="4" fill={color} stroke="#fff" strokeWidth="2" />
          <text x={x(ultimo) + 8} y={y(datos[ultimo].valor)} dy="0.32em" fontSize="11" fontWeight="600" fill={TINTA.primaria} style={cifras}>
            {formatoEje(datos[ultimo].valor)}
          </text>
          {activo !== null && (
            <g pointerEvents="none">
              <line x1={x(activo)} x2={x(activo)} y1={m.arriba} y2={m.arriba + h} stroke={TINTA.tenue} />
              <circle cx={x(activo)} cy={y(datos[activo].valor)} r="5" fill={color} stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {activo !== null && datos[activo] && (
        <Tooltip x={x(activo)} y={y(datos[activo].valor)} ancho={ancho} clave={color}
          valor={formatoValor(datos[activo].valor)} etiqueta={fechaLarga(datos[activo].clave)} />
      )}
    </div>
  );
};

/**
 * Barras horizontales para comparar categorías (valor en la punta de cada barra).
 * colores: { categoria: color } fija el color por categoría; si no, todas van en el color de la serie.
 */
export const GraficoBarras = ({ datos, color = SERIES[0], colores, formatoValor = numero, anchoEtiqueta = 130, descripcion }) => {
  const [ref, ancho] = useAncho();
  const [activo, setActivo] = useState(null);
  const fila = 34;
  const grosor = 18;
  const alto = Math.max(fila, datos.length * fila);
  const max = Math.max(0, ...datos.map(d => d.valor));
  const total = datos.reduce((s, d) => s + d.valor, 0);
  const zonaValor = 84;
  const w = Math.max(1, ancho - anchoEtiqueta - zonaValor);
  const largo = (v) => (max === 0 ? 0 : (v / max) * w);

  return (
    <div ref={ref} className="relative" style={{ height: alto }}>
      {ancho > 0 && (
        <svg width={ancho} height={alto} role="img" aria-label={descripcion}>
          <line x1={anchoEtiqueta} x2={anchoEtiqueta} y1={0} y2={alto} stroke={BASE} />
          {datos.map((d, i) => {
            const y0 = i * fila + (fila - grosor) / 2;
            const l = largo(d.valor);
            return (
              <g key={d.clave} tabIndex={0} className="outline-hidden cursor-default"
                onPointerEnter={() => setActivo(i)} onPointerLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)} onBlur={() => setActivo(null)}>
                <rect x={0} y={i * fila} width={ancho} height={fila} fill="transparent" />
                <text x={anchoEtiqueta - 10} y={y0 + grosor / 2} dy="0.32em" textAnchor="end" fontSize="12" fill={TINTA.secundaria}>
                  {d.clave.length > 20 ? `${d.clave.substring(0, 19)}…` : d.clave}
                </text>
                {l > 0 && (
                  <path d={barraHorizontal(anchoEtiqueta, y0, l, grosor)} fill={colores?.[d.clave] || color}
                    opacity={activo === null || activo === i ? 1 : 0.45} style={{ transition: 'opacity 120ms' }} />
                )}
                <text x={anchoEtiqueta + l + 8} y={y0 + grosor / 2} dy="0.32em" fontSize="12" fontWeight="600" fill={TINTA.primaria} style={cifras}>
                  {formatoValor(d.valor)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {activo !== null && total > 0 && (
        <Tooltip x={anchoEtiqueta + largo(datos[activo].valor)} y={activo * fila + fila / 2} ancho={ancho}
          clave={colores?.[datos[activo].clave] || color}
          valor={`${Math.round((datos[activo].valor / total) * 100)}% del total`} etiqueta={datos[activo].clave} />
      )}
    </div>
  );
};

/**
 * Columnas con una protagonista: la mayor va en el color de acento y el resto en gris
 * (énfasis: "este es el día con más gente"). Solo la protagonista lleva el valor escrito; el resto, en el tooltip.
 */
export const GraficoColumnas = ({ datos, alto = 220, color = SERIES[0], formatoValor = numero, formatoEje = compacto,
  etiquetaX = (c) => c, cadaCuantasEtiquetas = 1, descripcion, detalle = (d) => d.clave }) => {
  const [ref, ancho] = useAncho();
  const [activo, setActivo] = useState(null);
  const m = { arriba: 22, derecha: 8, abajo: 24, izquierda: 36 };
  const w = Math.max(1, ancho - m.izquierda - m.derecha);
  const h = alto - m.arriba - m.abajo;
  const valores = datos.map(d => d.valor);
  const mayor = Math.max(0, ...valores);
  const indiceMayor = mayor > 0 ? valores.indexOf(mayor) : -1;
  const { max, ticks } = escala(mayor, 3);
  const banda = w / Math.max(1, datos.length);
  const grosor = Math.min(24, banda * 0.62);
  const base = m.arriba + h;
  const altoDe = (v) => (v / max) * h;

  return (
    <div ref={ref} className="relative" style={{ height: alto }}>
      {ancho > 0 && (
        <svg width={ancho} height={alto} role="img" aria-label={descripcion}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={m.izquierda} x2={ancho - m.derecha} y1={base - altoDe(t)} y2={base - altoDe(t)} stroke={t === 0 ? BASE : GRILLA} />
              <text x={m.izquierda - 6} y={base - altoDe(t)} dy="0.32em" textAnchor="end" style={{ ...texto, ...cifras }}>{formatoEje(t)}</text>
            </g>
          ))}
          {datos.map((d, i) => {
            const cx = m.izquierda + banda * i + banda / 2;
            const a = altoDe(d.valor);
            const protagonista = i === indiceMayor;
            return (
              <g key={d.clave} tabIndex={0} className="outline-hidden"
                onPointerEnter={() => setActivo(i)} onPointerLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)} onBlur={() => setActivo(null)}>
                <rect x={cx - banda / 2} y={m.arriba} width={banda} height={h} fill="transparent" />
                {a > 0 && (
                  <path d={columna(cx - grosor / 2, base, a, grosor)} fill={protagonista ? color : GRIS_ENFASIS}
                    opacity={activo === null || activo === i ? 1 : 0.6} style={{ transition: 'opacity 120ms' }} />
                )}
                {protagonista && (
                  <text x={cx} y={base - a - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill={TINTA.primaria} style={cifras}>
                    {formatoEje(d.valor)}
                  </text>
                )}
                {(protagonista || (i % cadaCuantasEtiquetas === 0 && (cadaCuantasEtiquetas === 1 || Math.abs(i - indiceMayor) > 1))) && (
                  <text x={cx} y={alto - 6} textAnchor="middle" style={protagonista ? { ...texto, fill: TINTA.primaria, fontWeight: 600 } : texto}>{etiquetaX(d.clave)}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {activo !== null && (
        <Tooltip x={m.izquierda + banda * activo + banda / 2} y={base - altoDe(datos[activo].valor) / 2} ancho={ancho}
          clave={activo === indiceMayor ? color : GRIS_ENFASIS}
          valor={formatoValor(datos[activo].valor)} etiqueta={detalle(datos[activo])} />
      )}
    </div>
  );
};

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Mapa de calor día × hora: cuánta gente viene en cada franja (un solo tono, más oscuro = más gente).
 */
export const MapaCalor = ({ celdas, descripcion }) => {
  const [ref, ancho] = useAncho();
  const [activo, setActivo] = useState(null);
  const conDatos = celdas.map(c => c.hora);
  const horaDesde = Math.min(6, ...conDatos);
  const horaHasta = Math.max(22, ...conDatos);
  const horas = Array.from({ length: horaHasta - horaDesde + 1 }, (_, i) => horaDesde + i);
  const valor = {};
  celdas.forEach(c => { valor[`${c.dia}-${c.hora}`] = c.visitas; });
  const max = Math.max(0, ...celdas.map(c => c.visitas));
  const colorDe = (v) => (v <= 0 ? CERO : RAMPA[Math.min(RAMPA.length - 1, Math.floor((v / max) * RAMPA.length - 1e-9))]);

  const izquierda = 38;
  const altoCelda = 26;
  const gap = 2;
  const anchoCelda = Math.max(8, (ancho - izquierda) / horas.length);
  const alto = 7 * altoCelda + 22;
  const cadaCuantas = anchoCelda < 22 ? 3 : anchoCelda < 34 ? 2 : 1;

  return (
    <div>
      <div ref={ref} className="relative" style={{ height: alto }}>
        {ancho > 0 && (
          <svg width={ancho} height={alto} role="img" aria-label={descripcion}>
            {DIAS_CORTOS.map((d, fila) => (
              <text key={d} x={izquierda - 8} y={fila * altoCelda + altoCelda / 2} dy="0.32em" textAnchor="end" style={texto}>{d}</text>
            ))}
            {horas.map((hora, col) => (
              <g key={hora}>
                {col % cadaCuantas === 0 && (
                  <text x={izquierda + col * anchoCelda + anchoCelda / 2} y={alto - 6} textAnchor="middle" style={texto}>{hora}</text>
                )}
                {DIAS_CORTOS.map((_, fila) => {
                  const v = valor[`${fila}-${hora}`] || 0;
                  const esActiva = activo && activo.fila === fila && activo.hora === hora;
                  return (
                    <rect key={fila} x={izquierda + col * anchoCelda + gap / 2} y={fila * altoCelda + gap / 2}
                      width={anchoCelda - gap} height={altoCelda - gap} rx="3" fill={colorDe(v)}
                      stroke={esActiva ? TINTA.primaria : 'none'} strokeWidth="1.5" tabIndex={0} className="outline-hidden"
                      onPointerEnter={() => setActivo({ fila, hora, v, col })} onPointerLeave={() => setActivo(null)}
                      onFocus={() => setActivo({ fila, hora, v, col })} onBlur={() => setActivo(null)} />
                  );
                })}
              </g>
            ))}
          </svg>
        )}
        {activo && (
          <Tooltip x={izquierda + activo.col * anchoCelda + anchoCelda / 2} y={activo.fila * altoCelda + altoCelda / 2} ancho={ancho}
            valor={`${numero(activo.v)} ${activo.v === 1 ? 'visita' : 'visitas'}`}
            etiqueta={`${DIAS_LARGOS[activo.fila]} de ${activo.hora} a ${activo.hora + 1} h`} />
        )}
      </div>
      <div className="flex items-center justify-end gap-2 mt-3 text-[11px] text-slate-500">
        <span>Menos</span>
        <span className="w-4 h-3 rounded-xs" style={{ background: CERO }} />
        {RAMPA.map(c => <span key={c} className="w-4 h-3 rounded-xs" style={{ background: c }} />)}
        <span>Más{max > 0 ? ` (hasta ${numero(max)})` : ''}</span>
      </div>
    </div>
  );
};

/**
 * Barra 100% apilada para partes de un todo, con 2px de separación entre tramos, leyenda siempre visible
 * y el porcentaje escrito dentro del tramo solo si entra.
 */
export const BarraApilada = ({ datos, colores, formatoValor = numero, descripcion }) => {
  const [ref, ancho] = useAncho();
  const [activo, setActivo] = useState(null);
  const total = datos.reduce((s, d) => s + d.valor, 0);
  const visibles = datos.filter(d => d.valor > 0);
  const pct = (v) => (total === 0 ? 0 : (v / total) * 100);
  const blanco = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const luz = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return luz < 0.62;
  };

  return (
    <div>
      <div ref={ref} className="relative" role="img" aria-label={descripcion}>
        <div className="flex h-8 gap-[2px] rounded-md overflow-hidden bg-white">
          {visibles.map((d, i) => {
            const p = pct(d.valor);
            const entra = (p / 100) * ancho > 46;
            return (
              <div key={d.clave} tabIndex={0} className="h-full flex items-center justify-center outline-hidden transition-opacity"
                style={{ width: `${p}%`, background: colores[d.clave], opacity: activo === null || activo === i ? 1 : 0.5 }}
                onPointerEnter={() => setActivo(i)} onPointerLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)} onBlur={() => setActivo(null)}>
                {entra && (
                  <span className="text-[11px] font-semibold" style={{ color: blanco(colores[d.clave]) ? '#fff' : TINTA.primaria }}>
                    {Math.round(p)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {activo !== null && visibles[activo] && (
          <Tooltip
            x={(visibles.slice(0, activo).reduce((s, d) => s + pct(d.valor), 0) + pct(visibles[activo].valor) / 2) / 100 * ancho}
            y={16} ancho={ancho} clave={colores[visibles[activo].clave]}
            valor={`${formatoValor(visibles[activo].valor)} · ${Math.round(pct(visibles[activo].valor))}%`}
            etiqueta={visibles[activo].clave} />
        )}
      </div>
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {datos.map(d => (
          <li key={d.clave} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-slate-600 min-w-0">
              <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ background: colores[d.clave] }} />
              <span className="truncate">{d.clave}</span>
            </span>
            <span className="text-slate-900 font-medium tabular-nums whitespace-nowrap">
              {formatoValor(d.valor)} <span className="text-slate-400 font-normal">· {Math.round(pct(d.valor))}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
