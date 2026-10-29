import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Receipt, Ticket, UserCheck, Repeat, Hourglass } from 'lucide-react';
import { apiFetch } from '../services/api';
import { formatMoneda } from '../utils/formato';
import { textoMetodoPago } from '../utils/constantes';
import {
  SERIES, numero, compactoMoneda, fechaLarga, TarjetaKpi, TarjetaGrafico, SinDatos, FiltroPeriodo, periodoInicial,
} from '../components/graficos/base';
import { GraficoLinea, GraficoBarras, BarraApilada } from '../components/graficos/Graficos';

// Color fijo por canal y por método. Débito automático usa el mismo color en los dos gráficos y los tramos
// siguen el orden de la paleta (pares vecinos validados para daltonismo).
const COLORES_CANAL = { Presencial: SERIES[0], 'Débito automático': SERIES[1] };
const ORDEN_METODOS = ['DEBITO_AUTOMATICO', 'EFECTIVO', 'TRANSFERENCIA', 'MERCADO_PAGO', 'TARJETA_DEBITO', 'TARJETA_CREDITO'];
const COLORES_METODO = Object.fromEntries(ORDEN_METODOS.map((m, i) => [textoMetodoPago(m), SERIES[i + 1]]));

/**
 * Métricas de Planes (solo administración): ingresos aprobados, ticket promedio, planes que más facturan,
 * socios por plan y cómo se cobra (presencial o débito automático, y por método).
 */
const MetricasPlanes = () => {
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    apiFetch(`/metricas/ingresos?desde=${periodo.desde}&hasta=${periodo.hasta}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.status === 403) throw new Error('Estas métricas son solo para administración.');
        if (!res.ok) throw new Error(json.error || 'No se pudieron cargar las métricas');
        if (vigente) { setDatos(json); setError(''); }
      })
      .catch(err => vigente && setError(err.message))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [periodo.desde, periodo.hasta]);

  const ind = datos?.indicadores || {};
  const ingresos = ind.ingresos?.valor || 0;
  const variacion = ind.ingresos?.anterior ? Math.round(((ingresos - ind.ingresos.anterior) / ind.ingresos.anterior) * 100) : null;

  const metodos = datos
    ? ORDEN_METODOS.map(m => ({ clave: textoMetodoPago(m), valor: datos.ingresosPorMetodo.find(p => p.clave === m)?.valor || 0 }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Métricas de Planes</h1>
          <p className="text-sm text-slate-500">
            Ingresos aprobados, planes y formas de cobro
            {datos && ` · ${fechaLarga(datos.periodo.desde)} al ${fechaLarga(datos.periodo.hasta)}`}
          </p>
        </div>
        <FiltroPeriodo valor={periodo} onChange={setPeriodo} />
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>}

      {!datos ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">{cargando ? 'Cargando métricas…' : ''}</div>
      ) : (
        <div className={`space-y-6 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TarjetaGrafico className="lg:col-span-2" titulo="Ingresos aprobados"
              subtitulo={datos.agrupacion === 'MES' ? 'Por mes' : 'Por día'}
              tabla={{ columnas: ['Fecha', 'Ingresos'], filas: datos.ingresosEnElTiempo.map(d => [fechaLarga(d.clave), formatMoneda(d.valor)]) }}
              destacado={(
                <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                  <p className="text-5xl font-semibold text-slate-900 tracking-tight">{formatMoneda(ingresos)}</p>
                  {variacion !== null && (
                    <p className={`text-sm font-medium flex items-center gap-1 pb-1.5 ${variacion >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {variacion >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {variacion > 0 ? '+' : ''}{variacion}% vs. período anterior ({formatMoneda(ind.ingresos.anterior)})
                    </p>
                  )}
                </div>
              )}>
              <GraficoLinea datos={datos.ingresosEnElTiempo} alto={240} descripcion="Ingresos aprobados en el tiempo"
                formatoValor={formatMoneda} formatoEje={compactoMoneda} />
            </TarjetaGrafico>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
              <TarjetaKpi titulo="Cobros aprobados" icon={Receipt} valor={ind.cobros.valor} anterior={ind.cobros.anterior} />
              <TarjetaKpi titulo="Ticket promedio" icon={Ticket} valor={ind.ticketPromedio.valor} anterior={ind.ticketPromedio.anterior}
                formato={formatMoneda} />
              <TarjetaKpi titulo="Socios activos" icon={UserCheck} valor={ind.sociosActivos.valor} anterior={ind.sociosActivos.anterior}
                detalle="Con la membresía al día" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TarjetaGrafico titulo="Ingresos por plan" subtitulo="Qué planes facturan más en el período"
              tabla={{ columnas: ['Plan', 'Ingresos'], filas: datos.ingresosPorPlan.map(d => [d.clave, formatMoneda(d.valor)]) }}>
              {datos.ingresosPorPlan.length ? (
                <GraficoBarras datos={datos.ingresosPorPlan} formatoValor={compactoMoneda} descripcion="Ingresos por plan" />
              ) : <SinDatos texto="No hubo cobros aprobados en este período." />}
            </TarjetaGrafico>
            <TarjetaGrafico titulo="Socios activos por plan" subtitulo="Membresías al día hoy"
              tabla={{ columnas: ['Plan', 'Socios'], filas: datos.sociosPorPlan.map(d => [d.clave, numero(d.valor)]) }}>
              {datos.sociosPorPlan.length ? (
                <GraficoBarras datos={datos.sociosPorPlan} color={SERIES[0]} formatoValor={numero} descripcion="Socios activos por plan" />
              ) : <SinDatos texto="Todavía no hay socios con la membresía al día." />}
            </TarjetaGrafico>
          </div>

          <TarjetaGrafico titulo="Cómo se cobra" subtitulo="Presencial en recepción o débito automático mensual"
            tabla={{
              columnas: ['Canal / método', 'Ingresos'],
              filas: [...datos.ingresosPorCanal, ...metodos].map(d => [d.clave, formatMoneda(d.valor)]),
            }}>
            {ingresos > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-8">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Por canal</p>
                    <BarraApilada datos={datos.ingresosPorCanal} colores={COLORES_CANAL} formatoValor={formatMoneda}
                      descripcion="Ingresos presenciales y por débito automático" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Por método de pago</p>
                    <BarraApilada datos={metodos} colores={COLORES_METODO} formatoValor={formatMoneda}
                      descripcion="Ingresos por método de pago" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-4 content-start">
                  <TarjetaKpi titulo="Débitos automáticos activos" icon={Repeat} valor={ind.debitosActivos.valor} anterior={null} />
                  <TarjetaKpi titulo="Cobro recurrente" icon={Repeat} valor={ind.cobroRecurrente.valor} anterior={null}
                    formato={formatMoneda} detalle="Lo que entra solo cada mes" />
                  <TarjetaKpi titulo="Pagos a verificar" icon={Hourglass} valor={ind.pendientesVerificar.valor} anterior={null}
                    detalle={ind.pendientesVerificar.valor > 0 ? `${formatMoneda(ind.montoPendiente.valor)} sin confirmar en Caja` : 'Nada pendiente'} />
                </div>
              </div>
            ) : <SinDatos texto="No hubo cobros aprobados en este período." />}
          </TarjetaGrafico>
        </div>
      )}
    </div>
  );
};

export default MetricasPlanes;
