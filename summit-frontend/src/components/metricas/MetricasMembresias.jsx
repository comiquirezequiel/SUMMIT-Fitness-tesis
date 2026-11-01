import { Link } from 'react-router';
import { BadgeCheck, CalendarClock, CalendarX, Trophy, ArrowRight } from 'lucide-react';
import { useCarga } from '../../hooks/useCarga';
import { diasHasta } from '../../utils/formato';
import { SERIES, SIN_DATO, numero, TarjetaKpi, TarjetaGrafico, SinDatos } from '../graficos/base';
import { GraficoBarras, BarraApilada } from '../graficos/Graficos';
import { pedirMetricas, CargandoMetricas, ErrorMetricas } from './comun';

// Mismos cortes que Estado de socios > Membresías (y un color fijo por estado)
const COLORES_ESTADO = {
  'Al día': SERIES[2], 'Vence en 7 días': SERIES[3], Vencidas: SERIES[7], Congeladas: '#2a78d6', 'Sin membresía': SIN_DATO,
};
const COLORES_PAGO = { 'Débito automático': SERIES[1], Presencial: SERIES[0] };

const porcentaje = (parte, total) => (total > 0 ? Math.round((parte * 100) / total) : 0);

/**
 * Pestaña Planes / Membresías del tablero: qué planes se usan más, en qué estado están las membresías y cómo pagan los
 * socios al día. Es una foto de hoy: no depende del período. Lo de los débitos automáticos (cobros, rechazos) se ve en
 * Caja, en Cobros.
 */
const MetricasMembresias = ({ graficos }) => {
  const { datos, cargando, error } = useCarga(async () => {
    const [planes, socios, debitos] = await Promise.all([
      pedirMetricas('/planes', 'No se pudieron cargar los planes'),
      pedirMetricas('/socios', 'No se pudieron cargar los socios'),
      pedirMetricas('/debitos', 'No se pudieron cargar los débitos automáticos'),
    ]);
    return { planes, socios, debitos };
  }, []);

  if (error) return <ErrorMetricas mensaje={error} />;
  if (!datos) return <CargandoMetricas />;

  // Los socios dados de baja no cuentan
  const socios = datos.socios.filter(s => s.estado !== 'CANCELADO').map(s => ({ ...s, dias: diasHasta(s.vencimientoMembresia) }));
  const congeladas = socios.filter(s => s.congeladaHasta);
  const sinCongelar = socios.filter(s => !s.congeladaHasta);
  const vencidas = sinCongelar.filter(s => s.dias !== null && s.dias < 0);
  const porVencer = sinCongelar.filter(s => s.dias !== null && s.dias >= 0 && s.dias <= 7);
  const holgadas = sinCongelar.filter(s => s.dias !== null && s.dias > 7);
  const sinMembresia = sinCongelar.filter(s => s.dias === null);
  const alDia = socios.filter(s => s.membresiaAlDia);
  const conDebito = new Set(datos.debitos.filter(d => d.estado === 'ACTIVO').map(d => d.idSocio));

  // Socios con la membresía al día en cada plan, del más usado al menos usado
  const porPlan = datos.planes
    .map(p => ({ clave: p.nombrePlan, valor: alDia.filter(s => s.planActual === p.nombrePlan).length }))
    .filter(d => d.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.clave.localeCompare(b.clave));
  const masUsado = porPlan[0] || null;

  const estados = [
    { clave: 'Al día', valor: holgadas.length },
    { clave: 'Vence en 7 días', valor: porVencer.length },
    { clave: 'Vencidas', valor: vencidas.length },
    { clave: 'Congeladas', valor: congeladas.length },
    { clave: 'Sin membresía', valor: sinMembresia.length },
  ];
  const comoPagan = [
    { clave: 'Débito automático', valor: alDia.filter(s => conDebito.has(s.idSocio)).length },
    { clave: 'Presencial', valor: alDia.filter(s => !conDebito.has(s.idSocio)).length },
  ];

  return (
    <div className={`space-y-3 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        <TarjetaKpi titulo="Membresías al día" icon={BadgeCheck} valor={alDia.length} anterior={null}
          detalle={`${porcentaje(alDia.length, socios.length)}% de ${socios.length} socios`} />
        <TarjetaKpi titulo="Vencen en 7 días" icon={CalendarClock} valor={porVencer.length} anterior={null}
          detalle={porVencer.length ? 'Conviene recordarles' : 'Ninguna por ahora'} />
        <TarjetaKpi titulo="Vencidas" icon={CalendarX} valor={vencidas.length} anterior={null}
          detalle={`${congeladas.length} congeladas · ${sinMembresia.length} sin membresía`} />
        <TarjetaKpi titulo="Plan más elegido" icon={Trophy} valor={masUsado?.clave || '—'} anterior={null} formato={(v) => v}
          detalle={masUsado ? `${masUsado.valor} socios · ${porcentaje(masUsado.valor, alDia.length)}% de los activos` : 'Sin socios al día'} />
      </div>

      {graficos && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <TarjetaGrafico titulo="Membresías más usadas" subtitulo="Socios con la membresía al día, por plan"
            tabla={{ columnas: ['Plan', 'Socios'], filas: porPlan.map(d => [d.clave, numero(d.valor)]) }}>
            {porPlan.length ? (
              <GraficoBarras datos={porPlan} formatoValor={numero} anchoEtiqueta={130} zonaValor={32} descripcion="Socios al día por plan" />
            ) : <SinDatos texto="Todavía no hay socios con la membresía al día." />}
          </TarjetaGrafico>

          <TarjetaGrafico titulo="Estado de las membresías" subtitulo="Al día: faltan más de 7 días para el vencimiento"
            tabla={{ columnas: ['Estado', 'Socios'], filas: estados.map(d => [d.clave, numero(d.valor)]) }}>
            {socios.length ? (
              <>
                <BarraApilada datos={estados} colores={COLORES_ESTADO} descripcion="Socios por estado de la membresía"
                  formatoValor={(v) => `${numero(v)} ${v === 1 ? 'socio' : 'socios'}`} />
                <Link to="/socios/estado" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                  Ver quiénes son <ArrowRight className="w-3 h-3" />
                </Link>
              </>
            ) : <SinDatos texto="Todavía no hay socios." />}
          </TarjetaGrafico>

          <TarjetaGrafico titulo="Cómo pagan" subtitulo="Socios al día con débito automático o en recepción"
            tabla={{ columnas: ['Forma de pago', 'Socios'], filas: comoPagan.map(d => [d.clave, numero(d.valor)]) }}>
            {alDia.length ? (
              <BarraApilada datos={comoPagan} colores={COLORES_PAGO} descripcion="Socios al día por forma de pago"
                formatoValor={(v) => `${numero(v)} ${v === 1 ? 'socio' : 'socios'}`} />
            ) : <SinDatos texto="Todavía no hay socios con la membresía al día." />}
          </TarjetaGrafico>
        </div>
      )}
    </div>
  );
};

export default MetricasMembresias;
