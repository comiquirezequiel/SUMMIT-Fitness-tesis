import { Fragment, useState, useEffect, useRef } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, Table2, BarChart3 } from 'lucide-react';

// ---------- Tokens de los gráficos ----------
// Paleta categórica validada para daltonismo (orden fijo: el color sigue a la categoría, nunca a su posición).
// El texto nunca usa el color de una serie: valores y etiquetas van en tinta primaria/secundaria/tenue.
// Los grises son variables de index.css: cambian con el modo oscuro.
// La primera es el bordó del logo (la serie principal: líneas y barras de una sola serie).
export const SERIES = ['#b0385c', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const TINTA = { primaria: 'var(--grafico-tinta)', secundaria: 'var(--grafico-tinta-2)', tenue: 'var(--grafico-tinta-3)' };
export const GRILLA = 'var(--grafico-grilla)';
export const BASE = 'var(--grafico-base)';
export const GRIS_ENFASIS = 'var(--grafico-enfasis)'; // el resto de las barras cuando una sola es la protagonista
export const SIN_DATO = 'var(--grafico-sin-dato)';
// Rampa secuencial de un solo tono, el bordó del logo (más oscuro = más): mapa de calor
export const RAMPA = ['#f5d9e0', '#ebb3c2', '#da8aa0', '#c45e7d', '#a8395c', '#861d3a', '#5a0f24'];
export const CERO = 'var(--grafico-cero)';

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

// Escala pegada al dato (para las líneas): el techo es el valor más alto, sin aire de más arriba, y las marcas
// redondas quedan por debajo (como mucho divisiones + 1 tramos). Así cambian las marcas y no el tamaño del gráfico.
// Con valores de 1 en adelante las marcas son enteras, y el paso de 2,5 solo va de 25 para arriba (nada de 7,5 visitas).
export const escalaAjustada = (maximo, divisiones = 4) => {
  if (maximo <= 0) return { max: 1, ticks: [0, 1] };
  for (let exponente = Math.floor(Math.log10(maximo)) - 2; ; exponente++) {
    for (const f of [1, 2, 2.5, 5]) {
      const paso = f * 10 ** exponente;
      if ((maximo >= 1 && paso < 1) || (f === 2.5 && exponente < 1)) continue;
      const tramos = Math.floor(maximo / paso + 1e-9);
      if (tramos > divisiones + 1) continue;
      const ticks = [];
      for (let i = 0; i <= tramos; i++) ticks.push(Math.round(i * paso * 100) / 100);
      return { max: maximo, ticks };
    }
  }
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
  // Cuando no entra a la derecha pasa al otro lado deslizándose (si el sistema no pide menos movimiento)
  <div className="pointer-events-none absolute z-20 rounded-lg bg-white px-3 py-1.5 shadow-lg ring-1 ring-black/10 whitespace-nowrap motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out"
    style={{ left: x, top: y, transform: `translate(${x > ancho - 180 ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}>
    <div className="flex items-center gap-2">
      {clave && <span className="inline-block w-3 h-0.5 rounded-sm" style={{ background: clave }} />}
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
      variacion = valor > 0 ? { corto: 'nuevo', texto: 'Sin datos en el período anterior', tono: 'text-slate-500', Flecha: Minus } : null;
    } else {
      const pct = ((valor - anterior) / Math.abs(anterior)) * 100;
      const redondeado = Math.round(pct);
      const bueno = subirEsBueno ? pct > 0 : pct < 0;
      variacion = {
        corto: `${redondeado > 0 ? '+' : ''}${redondeado}%`,
        texto: `${redondeado > 0 ? '+' : ''}${redondeado}% vs. período anterior`,
        tono: redondeado === 0 ? 'text-slate-500' : bueno ? 'text-emerald-700' : 'text-rose-700',
        Flecha: redondeado === 0 ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight,
      };
    }
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs px-3 py-2.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500 truncate">{titulo}</p>
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
      </div>
      {/* La variación va al lado del número (el texto entero, al pasar el mouse): así la tarjeta tiene tres líneas como mucho */}
      <div className="flex items-baseline gap-2 mt-0.5 min-w-0">
        <p className="text-xl font-semibold text-slate-900 leading-tight truncate" title={String(formato(valor))}>{formato(valor)}</p>
        {variacion && (
          <p className={`text-xs font-medium flex items-center gap-0.5 shrink-0 ${variacion.tono}`} title={variacion.texto}>
            <variacion.Flecha className="w-3 h-3 shrink-0 self-center" /> {variacion.corto}
            <span className="sr-only"> vs. período anterior</span>
          </p>
        )}
      </div>
      {detalle && <p className="text-xs text-slate-500 mt-0.5 truncate" title={typeof detalle === 'string' ? detalle : undefined}>{detalle}</p>}
    </div>
  );
};

// Tabla con los mismos datos del gráfico (accesibilidad: ningún valor depende solo del color o del hover)
const TablaDatos = ({ columnas, filas }) => (
  <div className="max-h-72 overflow-auto rounded-lg border border-slate-100">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0">
        <tr>{columnas.map((c, i) => <th key={c} className={`px-3 py-1.5 font-medium ${i ? 'text-right' : 'text-left'}`}>{c}</th>)}</tr>
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

// version: al cambiar (por ejemplo, llegaron los datos de otro período) el gráfico se vuelve a montar y se redibuja con
// su animación de entrada; la tarjeta queda (y con ella, si estaba viendo la tabla o el gráfico)
export const TarjetaGrafico = ({ titulo, subtitulo, tabla, children, className = '', destacado, version }) => {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <section className={`bg-white rounded-xl border border-slate-200 shadow-xs p-3 min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
        </div>
        {tabla && (
          <button onClick={() => setVerTabla(v => !v)}
            className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-slate-50">
            {verTabla ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
            {verTabla ? 'Ver gráfico' : 'Ver datos'}
          </button>
        )}
      </div>
      {destacado && !verTabla && <div className="mb-2">{destacado}</div>}
      {verTabla ? <TablaDatos {...tabla} /> : <Fragment key={version}>{children}</Fragment>}
    </section>
  );
};

export const SinDatos = ({ texto = 'No hay datos en este período.' }) => (
  <div className="h-28 flex items-center justify-center text-sm text-slate-500">{texto}</div>
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
      <div className="flex flex-wrap bg-white border border-slate-200 rounded-lg p-0.5">
        {PERIODOS.map(p => (
          <button key={p.clave} onClick={() => onChange({ clave: p.clave, ...p.rango() })}
            className={`px-2 py-1 tactil:min-h-11 rounded-md text-xs font-semibold transition-colors ${valor.clave === p.clave ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {p.texto}
          </button>
        ))}
        <button onClick={() => onChange({ ...valor, clave: 'personalizado' })}
          className={`px-2 py-1 tactil:min-h-11 rounded-md text-xs font-semibold transition-colors ${personalizado ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          Personalizado
        </button>
      </div>
      {personalizado && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <input type="date" value={valor.desde} max={valor.hasta} onChange={e => e.target.value && onChange({ ...valor, desde: e.target.value })}
            className="border border-slate-200 rounded-lg px-1.5 py-1 bg-white" />
          <span>a</span>
          <input type="date" value={valor.hasta} min={valor.desde} max={iso(new Date())} onChange={e => e.target.value && onChange({ ...valor, hasta: e.target.value })}
            className="border border-slate-200 rounded-lg px-1.5 py-1 bg-white" />
        </div>
      )}
    </div>
  );
};
