import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, Table2, BarChart3 } from 'lucide-react';

// ---------- Tokens de los gráficos ----------
// Paleta categórica validada para daltonismo (orden fijo: el color sigue a la categoría, nunca a su posición).
// El texto nunca usa el color de una serie: valores y etiquetas van en tinta primaria/secundaria/tenue.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const TINTA = { primaria: '#0b0b0b', secundaria: '#52514e', tenue: '#898781' };
export const GRILLA = '#ebeae5';
export const BASE = '#c3c2b7';
export const GRIS_ENFASIS = '#cdd5df'; // el resto de las barras cuando una sola es la protagonista
export const SIN_DATO = '#b9b7ae';
// Rampa secuencial de un solo tono (más oscuro = más): mapa de calor
export const RAMPA = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
export const CERO = '#f3f2ee';

// ---------- Formatos ----------
const coma = (n, decimales = 1) => n.toLocaleString('es-AR', { maximumFractionDigits: decimales });

export const numero = (n) => coma(Number(n || 0));

export const compacto = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return `${coma(v / 1e6)} M`;
  if (Math.abs(v) >= 1e3) return `${coma(v / 1e3)} K`;
  return coma(v);
};

export const compactoMoneda = (n) => `$${compacto(n)}`;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// "2026-10-11" → "11/10" · "2026-05" → "may 26"
export const etiquetaFecha = (clave) => {
  const [anio, mes, dia] = clave.split('-');
  return dia ? `${dia}/${mes}` : `${MESES[Number(mes) - 1]} ${anio.substring(2)}`;
};

// "2026-10-11" → "sábado 11/10/2026" · "2026-05" → "mayo 2026"
export const fechaLarga = (clave) => {
  const [anio, mes, dia] = clave.split('-').map(Number);
  if (!dia) return `${new Date(anio, mes - 1, 1).toLocaleString('es-AR', { month: 'long' })} ${anio}`;
  return `${DIAS[new Date(anio, mes - 1, dia).getDay()]} ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
};

// Escala "redonda" para el eje Y: 0 / 5 / 10 / 15 en lugar de 0 / 4,3 / 8,6
export const escala = (maximo, divisiones = 4) => {
  if (maximo <= 0) return { max: 1, ticks: [0, 1] };
  const bruto = maximo / divisiones;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map(f => f * potencia).find(p => p >= bruto);
  const max = Math.ceil(maximo / paso) * paso;
  const ticks = [];
  for (let t = 0; t <= max + paso / 2; t += paso) ticks.push(Math.round(t * 100) / 100);
  return { max, ticks };
};

// ---------- Ancho del contenedor (los gráficos se adaptan al tamaño de la tarjeta) ----------
export const useAncho = () => {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observador = new ResizeObserver(([entrada]) => setAncho(Math.floor(entrada.contentRect.width)));
    observador.observe(ref.current);
    return () => observador.disconnect();
  }, []);
  return [ref, ancho];
};

// ---------- Piezas ----------

// Tooltip: el valor manda (fuerte) y la etiqueta acompaña. Se da vuelta cerca del borde derecho.
export const Tooltip = ({ x, y, ancho, valor, etiqueta, clave }) => (
  <div className="pointer-events-none absolute z-20 rounded-lg bg-white px-3 py-2 shadow-lg ring-1 ring-black/10 whitespace-nowrap"
    style={{ left: x, top: y, transform: `translate(${x > ancho - 180 ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}>
    <div className="flex items-center gap-2">
      {clave && <span className="inline-block w-3 h-0.5 rounded" style={{ background: clave }} />}
      <span className="text-sm font-semibold text-slate-900">{valor}</span>
    </div>
    <div className="text-xs text-slate-500 mt-0.5">{etiqueta}</div>
  </div>
);

/**
 * Indicador con su variación contra el período anterior.
 * El color de la variación depende de si subir es bueno (visitas) o malo (bajas), y siempre va con flecha y texto.
 */
export const TarjetaKpi = ({ titulo, valor, anterior, formato = numero, subirEsBueno = true, detalle, icon: Icon }) => {
  let variacion = null;
  if (anterior !== null && anterior !== undefined) {
    if (anterior === 0) {
      variacion = valor > 0 ? { texto: 'sin datos previos', tono: 'text-slate-500', Flecha: Minus } : null;
    } else {
      const pct = ((valor - anterior) / Math.abs(anterior)) * 100;
      const redondeado = Math.round(pct);
      const bueno = subirEsBueno ? pct > 0 : pct < 0;
      variacion = {
        texto: `${redondeado > 0 ? '+' : ''}${redondeado}% vs. período anterior`,
        tono: redondeado === 0 ? 'text-slate-500' : bueno ? 'text-emerald-700' : 'text-rose-700',
        Flecha: redondeado === 0 ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight,
      };
    }
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{titulo}</p>
        {Icon && <Icon className="w-4 h-4 text-slate-300" />}
      </div>
      <p className="text-2xl font-semibold text-slate-900 mt-1.5">{formato(valor)}</p>
      {variacion && (
        <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${variacion.tono}`}>
          <variacion.Flecha className="w-3.5 h-3.5" /> {variacion.texto}
        </p>
      )}
      {detalle && <p className="text-xs text-slate-500 mt-1">{detalle}</p>}
    </div>
  );
};

// Tabla con los mismos datos del gráfico (accesibilidad: ningún valor depende solo del color o del hover)
const TablaDatos = ({ columnas, filas }) => (
  <div className="max-h-72 overflow-auto rounded-lg border border-slate-100">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0">
        <tr>{columnas.map((c, i) => <th key={c} className={`px-3 py-2 font-medium ${i ? 'text-right' : 'text-left'}`}>{c}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {filas.map((fila, i) => (
          <tr key={i}>{fila.map((celda, j) => (
            <td key={j} className={`px-3 py-1.5 ${j ? 'text-right tabular-nums text-slate-800' : 'text-slate-600'}`}>{celda}</td>
          ))}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const TarjetaGrafico = ({ titulo, subtitulo, tabla, children, className = '', destacado }) => {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <section className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-slate-800">{titulo}</h2>
          {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
        </div>
        {tabla && (
          <button onClick={() => setVerTabla(v => !v)}
            className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-50">
            {verTabla ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
            {verTabla ? 'Ver gráfico' : 'Ver datos'}
          </button>
        )}
      </div>
      {destacado && !verTabla && <div className="mb-3">{destacado}</div>}
      {verTabla ? <TablaDatos {...tabla} /> : children}
    </section>
  );
};

export const SinDatos = ({ texto = 'No hay datos en este período.' }) => (
  <div className="h-40 flex items-center justify-center text-sm text-slate-400">{texto}</div>
);

// ---------- Filtro de período (una sola fila, arriba de todo; afecta a todos los gráficos) ----------

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ultimos = (dias) => {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - (dias - 1));
  return { desde: iso(desde), hasta: iso(hasta) };
};

export const PERIODOS = [
  { clave: '7', texto: '7 días', rango: () => ultimos(7) },
  { clave: '30', texto: '30 días', rango: () => ultimos(30) },
  { clave: '90', texto: '90 días', rango: () => ultimos(90) },
  { clave: 'mes', texto: 'Este mes', rango: () => { const h = new Date(); return { desde: iso(new Date(h.getFullYear(), h.getMonth(), 1)), hasta: iso(h) }; } },
  { clave: 'mesAnterior', texto: 'Mes anterior', rango: () => { const h = new Date(); return { desde: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), hasta: iso(new Date(h.getFullYear(), h.getMonth(), 0)) }; } },
  { clave: '365', texto: '12 meses', rango: () => ultimos(365) },
];

export const periodoInicial = () => ({ clave: '30', ...ultimos(30) });

export const FiltroPeriodo = ({ valor, onChange }) => {
  const personalizado = valor.clave === 'personalizado';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
        {PERIODOS.map(p => (
          <button key={p.clave} onClick={() => onChange({ clave: p.clave, ...p.rango() })}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${valor.clave === p.clave ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {p.texto}
          </button>
        ))}
        <button onClick={() => onChange({ ...valor, clave: 'personalizado' })}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${personalizado ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          Personalizado
        </button>
      </div>
      {personalizado && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <input type="date" value={valor.desde} max={valor.hasta} onChange={e => e.target.value && onChange({ ...valor, desde: e.target.value })}
            className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white" />
          <span>a</span>
          <input type="date" value={valor.hasta} min={valor.desde} max={iso(new Date())} onChange={e => e.target.value && onChange({ ...valor, hasta: e.target.value })}
            className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white" />
        </div>
      )}
    </div>
  );
};
