import { useState, useId } from 'react';
import {
  SERIES, TINTA, GRILLA, BASE, GRIS_ENFASIS, RAMPA, CERO,
  numero, compacto, etiquetaFecha, fechaLarga, escala, escalaAjustada, useAncho, Tooltip,
} from './base';

/*
 * Gráficos en SVG propio (sin librerías): marcas finas, extremos redondeados de 4px apoyados en la línea base,
 * grilla tenue de 1px, etiquetas selectivas y tooltip al pasar el mouse o con el teclado (Tab y flechas).
 */

const texto = { fontSize: 11, fill: TINTA.tenue };
const cifras = { fontVariantNumeric: 'tabular-nums' };

// Lo que ocupa un texto con la letra de la página: los márgenes se ajustan a lo que hay que escribir (un "60" no
// necesita el lugar de un "$300 K") y el gráfico usa el resto
let lienzo;
const anchoTexto = (valor, tamanio = 11, peso = 400) => {
  lienzo ??= document.createElement('canvas').getContext('2d');
  lienzo.font = `${peso} ${tamanio}px ${getComputedStyle(document.body).fontFamily}`;
  return Math.ceil(lienzo.measureText(String(valor)).width);
};
const masAncho = (valores, tamanio, peso) => Math.max(0, ...valores.map(v => anchoTexto(v, tamanio, peso)));

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

// Pendiente de la curva en cada punto, para que pase por todos sin pasarse de largo (monótona: entre dos días nunca
// sube más que el mayor ni baja más que el menor, así no inventa picos ni valores bajo cero)
const pendientesMonotonas = (puntos) => {
  const n = puntos.length;
  if (n < 2) return [];
  const dx = [];
  const pendiente = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = puntos[i + 1][0] - puntos[i][0];
    pendiente[i] = (puntos[i + 1][1] - puntos[i][1]) / dx[i];
  }
  const t = [pendiente[0]];
  for (let i = 1; i < n - 1; i++) {
    const a = pendiente[i - 1];
    const b = pendiente[i];
    t[i] = a * b <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / a + (dx[i] + 2 * dx[i - 1]) / b);
  }
  t[n - 1] = pendiente[n - 2];
  return t;
};

// La altura de la curva en cualquier x (para que el punto que sigue al mouse vaya por la línea). Cada tramo es una
// Bézier con los controles a un tercio y a dos tercios del tramo: avanza en x de forma pareja, así que la fracción del
// tramo sale directo de la x
const alturaEnCurva = (puntos, t, px) => {
  if (puntos.length < 2) return puntos[0]?.[1] ?? 0;
  let i = 0;
  while (i < puntos.length - 2 && px > puntos[i + 1][0]) i++;
  const [x0, y0] = puntos[i];
  const [x1, y1] = puntos[i + 1];
  const h = (x1 - x0) / 3;
  const c1 = y0 + t[i] * h;
  const c2 = y1 - t[i + 1] * h;
  const u = Math.min(1, Math.max(0, (px - x0) / (x1 - x0)));
  const v = 1 - u;
  return v * v * v * y0 + 3 * v * v * u * c1 + 3 * v * u * u * c2 + u * u * u * y1;
};

// Curva suave que pasa por cada punto (ver pendientesMonotonas)
const curvaSuave = (puntos, t = pendientesMonotonas(puntos)) => {
  const n = puntos.length;
  if (n < 2) return n ? `M${puntos[0][0]},${puntos[0][1]}` : '';
  const dx = puntos.slice(1).map((p, i) => p[0] - puntos[i][0]);
  let d = `M${puntos[0][0]},${puntos[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${puntos[i][0] + h},${puntos[i][1] + t[i] * h} ${puntos[i + 1][0] - h},${puntos[i + 1][1] - t[i + 1] * h} ${puntos[i + 1][0]},${puntos[i + 1][1]}`;
  }
  return d;
};

/**
 * Evolución en el tiempo de una sola serie: curva suave de 2px, área con degradé que se desvanece hacia abajo y una
 * línea punteada con el promedio del período (para ver qué días estuvieron arriba). Con el mouse, la guía sigue al
 * puntero sin saltos: el punto se desliza por la curva y el tooltip muestra el día más cercano. Con el teclado (flechas)
 * va de día en día.
 */
export const GraficoLinea = ({ datos, alto = 260, color = SERIES[0], formatoValor = numero, formatoEje = compacto, descripcion }) => {
  const [ref, ancho] = useAncho();
  const [activo, setActivo] = useState(null);
  // Dónde está el mouse (x dentro del gráfico); null = se eligió el día con el teclado
  const [puntero, setPuntero] = useState(null);
  const degrade = `degrade-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { max, ticks } = escalaAjustada(Math.max(0, ...datos.map(d => d.valor)));
  const ultimo = datos.length - 1;
  // A la izquierda, los valores del eje (y 8px de aire); a la derecha, el valor escrito junto al último punto
  const m = {
    arriba: 14, abajo: 26,
    izquierda: masAncho(ticks.map(formatoEje)) + 10,
    derecha: ultimo < 0 ? 12 : anchoTexto(formatoEje(datos[ultimo].valor), 11, 600) + 14,
  };
  const w = Math.max(1, ancho - m.izquierda - m.derecha);
  const h = alto - m.arriba - m.abajo;
  const x = (i) => m.izquierda + (datos.length <= 1 ? w / 2 : (i * w) / (datos.length - 1));
  const y = (v) => m.arriba + h - (v / max) * h;
  const puntos = datos.map((d, i) => [x(i), y(d.valor)]);
  const pendientes = pendientesMonotonas(puntos);
  const linea = curvaSuave(puntos, pendientes);
  const area = `${linea} L${x(ultimo)},${y(0)} L${x(0)},${y(0)} Z`;
  const promedio = datos.length ? datos.reduce((s, d) => s + d.valor, 0) / datos.length : 0;

  // Etiquetas del eje X cada tanto, contadas desde el final (la última fecha siempre se ve)
  const paso = Math.max(1, Math.ceil(datos.length / Math.max(2, Math.floor(w / 70))));
  const etiquetasX = [];
  for (let i = ultimo; i >= 0; i -= paso) etiquetasX.push(i);

  const mover = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = Math.min(x(ultimo), Math.max(x(0), e.clientX - r.left));
    const i = ultimo < 1 ? 0 : Math.round(((px - m.izquierda) / w) * ultimo);
    setActivo(Math.min(ultimo, Math.max(0, i)));
    setPuntero(px);
  };
  const salir = () => {
    setActivo(null);
    setPuntero(null);
  };
  const teclado = (e) => {
    if (e.key === 'ArrowRight') setActivo(a => Math.min(ultimo, (a ?? -1) + 1));
    if (e.key === 'ArrowLeft') setActivo(a => Math.max(0, (a ?? ultimo + 1) - 1));
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') setPuntero(null);
  };
  // Lo que se señala: el punto de la curva bajo el mouse, o el día elegido con el teclado
  const guia = activo === null || !datos[activo] ? null
    : puntero !== null ? { x: puntero, y: alturaEnCurva(puntos, pendientes, puntero) }
      : { x: x(activo), y: y(datos[activo].valor) };

  return (
    <div ref={ref} className="relative" style={{ height: alto }}>
      {ancho > 0 && datos.length > 0 && (
        <svg width={ancho} height={alto} role="img" aria-label={descripcion} tabIndex={0}
          className="outline-hidden focus-visible:ring-2 focus-visible:ring-blue-200 rounded-sm"
          onPointerMove={mover} onPointerLeave={salir}
          onFocus={() => setActivo(a => a ?? ultimo)} onBlur={salir} onKeyDown={teclado}>
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
          <defs>
            <linearGradient id={degrade} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.3" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${degrade})`} className="grafico-funde" />
          {promedio > 0 && (
            <g className="grafico-funde" pointerEvents="none">
              <line x1={m.izquierda} x2={ancho - m.derecha} y1={y(promedio)} y2={y(promedio)} stroke={TINTA.tenue} strokeDasharray="4 4" />
              <text x={m.izquierda + 4} y={y(promedio) - 5} style={texto}>Promedio {formatoEje(promedio)}</text>
            </g>
          )}
          <path d={linea} pathLength="1" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
            className="grafico-traza" />
          {/* Etiqueta directa solo en el último punto */}
          <circle cx={x(ultimo)} cy={y(datos[ultimo].valor)} r="4" fill={color} stroke="#fff" strokeWidth="2" className="grafico-funde" />
          <text x={x(ultimo) + 8} y={y(datos[ultimo].valor)} dy="0.32em" fontSize="11" fontWeight="600" fill={TINTA.primaria} style={cifras}
            className="grafico-funde">
            {formatoEje(datos[ultimo].valor)}
          </text>
          {guia && (
            <g pointerEvents="none">
              <line x1={guia.x} x2={guia.x} y1={m.arriba} y2={m.arriba + h} stroke={TINTA.tenue} />
              {/* El día que muestra el tooltip, marcado sobre la curva mientras el punto se desliza entre días */}
              {puntero !== null && <circle cx={x(activo)} cy={y(datos[activo].valor)} r="3" fill={color} opacity="0.6" />}
              <circle cx={guia.x} cy={guia.y} r="5" fill={color} stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {guia && (
        <Tooltip x={guia.x} y={guia.y} ancho={ancho} clave={color}
          valor={formatoValor(datos[activo].valor)} etiqueta={fechaLarga(datos[activo].clave)} />
      )}
    </div>
  );
};

/**
 * Barras horizontales para comparar categorías (valor en la punta de cada barra).
 * colores: { categoria: color } fija el color por categoría; si no, todas van en el color de la serie.
 */
export const GraficoBarras = ({ datos, color = SERIES[0], colores, formatoValor = numero, anchoEtiqueta: anchoMaximo = 130,
  zonaValor: zonaMaxima = 84, descripcion }) => {
  const [ref, ancho] = useAncho();
  const [activo, setActivo] = useState(null);
  const fila = 28;
  const grosor = 14;
  const alto = Math.max(fila, datos.length * fila);
  const max = Math.max(0, ...datos.map(d => d.valor));
  const total = datos.reduce((s, d) => s + d.valor, 0);
  const nombre = (clave) => (clave.length > 20 ? `${clave.substring(0, 19)}…` : clave);
  // Lo justo para el nombre más largo y el valor más largo (como mucho, lo que pide quien lo usa): el resto es barra
  const anchoEtiqueta = Math.min(anchoMaximo, masAncho(datos.map(d => nombre(d.clave)), 12) + 14);
  const zonaValor = Math.min(zonaMaxima, masAncho(datos.map(d => formatoValor(d.valor)), 12, 600) + 12);
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
                  {nombre(d.clave)}
                </text>
                {l > 0 && (
                  <path d={barraHorizontal(anchoEtiqueta, y0, l, grosor)} fill={colores?.[d.clave] || color}
                    opacity={activo === null || activo === i ? 1 : 0.45} className="grafico-crece-x"
                    style={{ transition: 'opacity 120ms', animationDelay: `${i * 50}ms` }} />
                )}
                <text x={anchoEtiqueta + l + 8} y={y0 + grosor / 2} dy="0.32em" fontSize="12" fontWeight="600" fill={TINTA.primaria} style={cifras}
                  className="grafico-funde">
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
  const valores = datos.map(d => d.valor);
  const mayor = Math.max(0, ...valores);
  const indiceMayor = mayor > 0 ? valores.indexOf(mayor) : -1;
  const { max, ticks } = escala(mayor, 3);
  // A la izquierda, lo justo para los valores del eje (y 6px de aire)
  const m = { arriba: 22, derecha: 8, abajo: 24, izquierda: masAncho(ticks.map(formatoEje)) + 8 };
  const w = Math.max(1, ancho - m.izquierda - m.derecha);
  const h = alto - m.arriba - m.abajo;
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
                    opacity={activo === null || activo === i ? 1 : 0.6} className="grafico-crece-y"
                    style={{ transition: 'opacity 120ms', animationDelay: `${i * 30}ms` }} />
                )}
                {protagonista && (
                  <text x={cx} y={base - a - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill={TINTA.primaria} style={cifras}
                    className="grafico-funde">
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
export const MapaCalor = ({ celdas, descripcion, altoCelda = 26 }) => {
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
      <div className="flex items-center justify-end gap-2 mt-2 text-xs text-slate-500">
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
  // Blanco o tinta oscura: la que más contraste tenga con el color del tramo (luminancia de WCAG)
  const blanco = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const luminancia = 0.2126 * canal(n >> 16) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
    return 1.05 / (luminancia + 0.05) > (luminancia + 0.05) / 0.0535;
  };

  return (
    <div>
      <div ref={ref} className="relative" role="img" aria-label={descripcion}>
        <div className="flex h-6 gap-[2px] rounded-md overflow-hidden bg-white grafico-crece-x">
          {visibles.map((d, i) => {
            const p = pct(d.valor);
            const entra = (p / 100) * ancho > 46;
            return (
              <div key={d.clave} tabIndex={0} className="h-full flex items-center justify-center outline-hidden transition-opacity"
                style={{ width: `${p}%`, background: colores[d.clave], opacity: activo === null || activo === i ? 1 : 0.5 }}
                onPointerEnter={() => setActivo(i)} onPointerLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)} onBlur={() => setActivo(null)}>
                {entra && (
                  <span className="text-xs font-semibold" style={{ color: blanco(colores[d.clave]) ? '#fff' : 'var(--grafico-tinta-sobre-color)' }}>
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
            y={12} ancho={ancho} clave={colores[visibles[activo].clave]}
            valor={`${formatoValor(visibles[activo].valor)} · ${Math.round(pct(visibles[activo].valor))}%`}
            etiqueta={visibles[activo].clave} />
        )}
      </div>
      <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-4 gap-y-1">
        {datos.map(d => (
          <li key={d.clave} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-slate-600 min-w-0">
              <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ background: colores[d.clave] }} />
              <span className="truncate">{d.clave}</span>
            </span>
            <span className="text-slate-900 font-medium tabular-nums whitespace-nowrap">
              {formatoValor(d.valor)} <span className="text-slate-500 font-normal">· {Math.round(pct(d.valor))}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Rueda (dona) para partes de un todo: anillo fino, cada tramo con su color, puntas redondeadas y aire entre tramos y,
 * en el centro, el total o el tramo que se señala (con el mouse o el teclado). Al costado, la leyenda con el monto y el porcentaje de cada uno;
 * senalar una fila de la leyenda también resalta su tramo. Solo entran las categorías con algo.
 * apilada: la leyenda siempre abajo y todo centrado en el alto que tenga la tarjeta (para una rueda grande).
 * leyendaEnDosColumnas: para categorías cortas (como los rangos de edad) en una tarjeta angosta: la rueda queda más baja.
 */
export const GraficoDona = ({ datos, colores, formatoValor = numero, descripcion, textoTotal = 'Total', tamanio = 168, apilada = false,
  leyendaEnDosColumnas = false }) => {
  const [activo, setActivo] = useState(null);
  const visibles = datos.filter(d => d.valor > 0);
  const total = visibles.reduce((s, d) => s + d.valor, 0);
  // El anillo engorda un poco en las ruedas grandes para no verse como un hilo
  const grosor = Math.max(14, Math.round(tamanio / 15));
  const r = (tamanio - grosor) / 2 - 4; // 4px de margen para que el tramo resaltado (más grueso) no se corte
  const circunferencia = 2 * Math.PI * r;
  // Con un solo tramo, el anillo entero; con varios, puntas redondas (cada una asoma medio grosor fuera de su trazo,
  // por eso se descuentan del largo) y 6px de aire entre tramos, que alcanzan aunque el señalado engorde
  const redondeado = visibles.length > 1;
  const aire = redondeado ? 6 : 0;
  const puntas = redondeado ? grosor : 0;
  const pct = (v) => (total === 0 ? 0 : (v / total) * 100);
  // Al aparecer, la rueda se completa en este tiempo: cada tramo tarda según su largo
  const dibujo = 700;

  let acumulado = 0;
  const tramos = visibles.map((d, i) => {
    const largo = (d.valor / total) * circunferencia;
    const tramo = {
      ...d, i, inicio: acumulado, porcion: largo,
      largo: Math.max(0.5, largo - aire - puntas), desde: acumulado + (aire + puntas) / 2,
    };
    acumulado += largo;
    return tramo;
  });
  const enCentro = activo !== null ? visibles[activo] : null;
  const senalar = (i) => ({
    onPointerEnter: () => setActivo(i), onPointerLeave: () => setActivo(null),
    onFocus: () => setActivo(i), onBlur: () => setActivo(null),
  });

  return (
    <div className={`flex items-center gap-4 flex-1 justify-center ${apilada ? 'flex-col' : 'flex-col sm:flex-row'}`}>
      <div className="relative shrink-0" style={{ width: tamanio, height: tamanio }}>
        <svg width={tamanio} height={tamanio} viewBox={`0 0 ${tamanio} ${tamanio}`} role="img" aria-label={descripcion}
          className="-rotate-90">
          <circle cx={tamanio / 2} cy={tamanio / 2} r={r} fill="none" stroke={CERO} strokeWidth={grosor} />
          {tramos.map(t => (
            <circle key={t.clave} cx={tamanio / 2} cy={tamanio / 2} r={r} fill="none" tabIndex={0}
              stroke={colores[t.clave]} strokeWidth={activo === t.i ? grosor + 4 : grosor} strokeLinecap={redondeado ? 'round' : 'butt'}
              strokeDasharray={`${t.largo} ${circunferencia}`} strokeDashoffset={-t.desde}
              opacity={activo === null || activo === t.i ? 1 : 0.35}
              className="outline-hidden cursor-default grafico-tramo"
              style={{
                transition: 'opacity 150ms, stroke-width 150ms', '--circunferencia': circunferencia,
                animationDuration: `${(t.porcion / circunferencia) * dibujo}ms`, animationDelay: `${(t.inicio / circunferencia) * dibujo}ms`,
              }}
              {...senalar(t.i)} />
          ))}
        </svg>
        {/* El centro: el total o el tramo señalado */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-6 grafico-funde">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 truncate max-w-full">
            {enCentro ? enCentro.clave : textoTotal}
          </span>
          <span className={`${tamanio >= 240 ? 'text-2xl' : 'text-xl'} font-extrabold text-slate-900 tabular-nums leading-tight`}>
            {formatoValor(enCentro ? enCentro.valor : total)}
          </span>
          {enCentro && <span className="text-xs font-semibold text-slate-500 tabular-nums">{Math.round(pct(enCentro.valor))}%</span>}
        </div>
      </div>
      {/* Cada fila en una línea: el nombre a la izquierda y el monto con el porcentaje contra el borde derecho */}
      {/* Al costado de la rueda, la leyenda mide lo que su fila más larga: el dato queda cerca del nombre */}
      <ul className={`w-full min-w-0 ${leyendaEnDosColumnas ? 'grid grid-cols-2 gap-x-3 gap-y-0.5 max-w-sm' : `space-y-0.5 ${apilada ? '' : 'sm:w-auto'}`}`}>
        {visibles.map((d, i) => (
          <li key={d.clave} tabIndex={0} {...senalar(i)}
            className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs outline-hidden transition-colors ${activo === i ? 'bg-slate-100' : ''}`}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colores[d.clave] }} />
            <span className="min-w-0 truncate text-slate-600">{d.clave}</span>
            <span className="ml-auto pl-2 shrink-0 whitespace-nowrap tabular-nums">
              <span className="font-semibold text-slate-900">{formatoValor(d.valor)}</span>
              <span className="text-slate-500"> · {Math.round(pct(d.valor))}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
