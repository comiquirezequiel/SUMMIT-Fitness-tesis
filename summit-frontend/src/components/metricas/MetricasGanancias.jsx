import { Banknote, Receipt, Ticket, UserCheck, Repeat, Hourglass } from 'lucide-react';
import { useCarga } from '../../hooks/useCarga';
import { formatMoneda } from '../../utils/formato';
import { textoMetodoPago } from '../../utils/constantes';
import { SERIES, compactoMoneda, fechaLarga, TarjetaKpi, TarjetaGrafico, SinDatos } from '../graficos/base';
import { GraficoLinea, GraficoBarras, GraficoDona } from '../graficos/Graficos';
import { pedirMetricas, CargandoMetricas, ErrorMetricas, FilaKpis } from './comun';

// Color fijo por método: los tramos siguen el orden de la paleta (pares vecinos validados para daltonismo)
const ORDEN_METODOS = ['DEBITO_AUTOMATICO', 'EFECTIVO', 'TRANSFERENCIA', 'MERCADO_PAGO', 'TARJETA_DEBITO', 'TARJETA_CREDITO'];
const COLORES_METODO = Object.fromEntries(ORDEN_METODOS.map((m, i) => [textoMetodoPago(m), SERIES[i + 1]]));

const porSocio = (ingresos, socios) => (socios > 0 ? ingresos / socios : 0);

/**
 * Pestaña Ganancias del tablero (solo administración): ingresos aprobados en el tiempo, cobros, ticket promedio,
 * lo que factura cada plan y con qué método se cobra. Antes era la pantalla
 * Métricas de Planes de Membresías.
 */
const MetricasGanancias = ({ periodo, graficos }) => {
  const { datos, cargando, error, version } = useCarga(
    () => pedirMetricas(`/metricas/ingresos?desde=${periodo.desde}&hasta=${periodo.hasta}`),
    [periodo.desde, periodo.hasta],
  );

  if (error) return <ErrorMetricas mensaje={error} />;
  if (!datos) return <CargandoMetricas />;

  const ind = datos.indicadores;
  const ingresos = ind.ingresos.valor;
  const metodos = ORDEN_METODOS.map(m => ({ clave: textoMetodoPago(m), valor: datos.ingresosPorMetodo.find(p => p.clave === m)?.valor || 0 }));
  const anteriorPorSocio = ind.ingresos.anterior != null && ind.sociosActivos.anterior != null
    ? porSocio(ind.ingresos.anterior, ind.sociosActivos.anterior) : null;

  return (
    <div className={`space-y-3 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
      <FilaKpis>
        <TarjetaKpi titulo="Ingresos aprobados" icon={Banknote} valor={ingresos} anterior={ind.ingresos.anterior} formato={formatMoneda} />
        <TarjetaKpi titulo="Cobros aprobados" icon={Receipt} valor={ind.cobros.valor} anterior={ind.cobros.anterior} />
        <TarjetaKpi titulo="Ticket promedio" icon={Ticket} valor={ind.ticketPromedio.valor} anterior={ind.ticketPromedio.anterior}
          formato={formatMoneda} />
        <TarjetaKpi titulo="Ingreso por socio activo" icon={UserCheck} valor={porSocio(ingresos, ind.sociosActivos.valor)}
          anterior={anteriorPorSocio} formato={formatMoneda} detalle={`${ind.sociosActivos.valor} socios con la membresía al día`} />
        <TarjetaKpi titulo="Cobro recurrente" icon={Repeat} valor={ind.cobroRecurrente.valor} anterior={null} formato={formatMoneda}
          detalle={`${ind.debitosActivos.valor} débitos automáticos activos`} />
        <TarjetaKpi titulo="Pagos a verificar" icon={Hourglass} valor={ind.pendientesVerificar.valor} anterior={null}
          detalle={ind.pendientesVerificar.valor > 0 ? `${formatMoneda(ind.montoPendiente.valor)} sin confirmar en Caja` : 'Nada pendiente'} />
      </FilaKpis>

      {graficos && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <TarjetaGrafico version={version} className="lg:col-span-2" titulo="Ingresos aprobados"
            subtitulo={datos.agrupacion === 'MES' ? 'Por mes' : 'Por día'}
            tabla={{ columnas: ['Fecha', 'Ingresos'], filas: datos.ingresosEnElTiempo.map(d => [fechaLarga(d.clave), formatMoneda(d.valor)]) }}>
            <GraficoLinea datos={datos.ingresosEnElTiempo} alto={180} descripcion="Ingresos aprobados en el tiempo"
              formatoValor={formatMoneda} formatoEje={compactoMoneda} />
          </TarjetaGrafico>
          <TarjetaGrafico version={version} className="lg:row-span-2 flex flex-col" titulo="Cómo se cobra" subtitulo="Ingresos por método de pago · pasá el mouse por la rueda"
            tabla={{ columnas: ['Método', 'Ingresos'], filas: metodos.map(d => [d.clave, formatMoneda(d.valor)]) }}>
            {ingresos > 0 ? (
              <GraficoDona datos={metodos} colores={COLORES_METODO} formatoValor={formatMoneda} textoTotal="Cobrado" tamanio={188} apilada
                descripcion="Ingresos por método de pago" />
            ) : <SinDatos texto="No hubo cobros aprobados en este período." />}
          </TarjetaGrafico>
          <TarjetaGrafico version={version} className="lg:col-span-2" titulo="Ingresos por plan" subtitulo="Qué planes facturan más en el período"
            tabla={{ columnas: ['Plan', 'Ingresos'], filas: datos.ingresosPorPlan.map(d => [d.clave, formatMoneda(d.valor)]) }}>
            {datos.ingresosPorPlan.length ? (
              <GraficoBarras datos={datos.ingresosPorPlan} formatoValor={compactoMoneda} anchoEtiqueta={130} zonaValor={60}
                descripcion="Ingresos por plan" />
            ) : <SinDatos texto="No hubo cobros aprobados en este período." />}
          </TarjetaGrafico>
        </div>
      )}
    </div>
  );
};

export default MetricasGanancias;
