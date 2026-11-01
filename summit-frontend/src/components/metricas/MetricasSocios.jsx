import { LogIn, Users, UserCheck, UserPlus, UserMinus, Sparkles } from 'lucide-react';
import { useCarga } from '../../hooks/useCarga';
import { SERIES, SIN_DATO, numero, fechaLarga, TarjetaKpi, TarjetaGrafico, SinDatos } from '../graficos/base';
import { GraficoLinea, GraficoColumnas, GraficoDona } from '../graficos/Graficos';
import { pedirMetricas, CargandoMetricas, ErrorMetricas, FilaKpis, decimal } from './comun';

const DIAS_LARGOS = { Lun: 'lunes', Mar: 'martes', Mié: 'miércoles', Jue: 'jueves', Vie: 'viernes', Sáb: 'sábados', Dom: 'domingos' };
const DIAS_CELDA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
// Color fijo por rango de edad (el color sigue al rango aunque cambie el período)
const COLORES_EDAD = {
  'Menos de 18': SERIES[0], '18 a 25': SERIES[1], '26 a 35': SERIES[2], '36 a 45': SERIES[3], '46 a 55': SERIES[4],
  '56 o más': SERIES[6], 'Sin dato': SIN_DATO,
};

/**
 * Pestaña Socios del tablero: asistencia real (ingresos permitidos por el control de acceso), horarios pico y edad de
 * quienes vienen. Todo se compara con el período anterior del mismo largo.
 */
const MetricasSocios = ({ periodo, graficos }) => {
  const { datos, cargando, error, version } = useCarga(
    () => pedirMetricas(`/metricas/socios?desde=${periodo.desde}&hasta=${periodo.hasta}`),
    [periodo.desde, periodo.hasta],
  );

  if (error) return <ErrorMetricas mensaje={error} />;
  if (!datos) return <CargandoMetricas />;

  const ind = datos.indicadores;
  const hayVisitas = (ind.visitas?.valor || 0) > 0;

  // Lo más destacado, dicho en palabras
  let franjaPico = null;
  if (datos.mapaCalor.length) {
    const pico = datos.mapaCalor.reduce((a, b) => (b.visitas > a.visitas ? b : a));
    franjaPico = `${DIAS_CELDA[pico.dia]} de ${pico.hora} a ${pico.hora + 1} h`;
  }
  const diaPico = datos.promedioPorDiaSemana.reduce((a, b) => (b.valor > a.valor ? b : a));
  const horaPico = datos.visitasPorHora.reduce((a, b) => (b.valor > a.valor ? b : a));
  // De la primera a la última hora en que vino alguien: sin columnas vacías antes de abrir ni después de cerrar
  const primeraHora = datos.visitasPorHora.findIndex(d => d.valor > 0);
  const ultimaHora = datos.visitasPorHora.findLastIndex(d => d.valor > 0);
  const horasDelDia = primeraHora < 0 ? datos.visitasPorHora.slice(6) : datos.visitasPorHora.slice(primeraHora, ultimaHora + 1);

  return (
    <div className={`space-y-3 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
      <FilaKpis columnasPc="xl:grid-cols-5">
        <TarjetaKpi titulo="Visitas" icon={LogIn} valor={ind.visitas.valor} anterior={ind.visitas.anterior} />
        <TarjetaKpi titulo="Socios que vinieron" icon={Users} valor={ind.visitantesUnicos.valor} anterior={ind.visitantesUnicos.anterior} />
        <TarjetaKpi titulo="Socios activos" icon={UserCheck} valor={ind.sociosActivos.valor} anterior={ind.sociosActivos.anterior}
          detalle="Con la membresía al día" />
        <TarjetaKpi titulo="Socios nuevos" icon={UserPlus} valor={ind.nuevos.valor} anterior={ind.nuevos.anterior} />
        <TarjetaKpi titulo="Bajas" icon={UserMinus} valor={ind.bajas.valor} anterior={ind.bajas.anterior} subirEsBueno={false}
          detalle="Membresías vencidas sin renovar" />
      </FilaKpis>

      {hayVisitas && (
        <p className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/70 border border-blue-100 text-xs text-slate-700">
          <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-px" />
          <span>
            En promedio vienen <b>{decimal(ind.promedioDiario.valor)} personas por día abierto</b>.
            {diaPico.valor > 0 && <> Los <b>{DIAS_LARGOS[diaPico.clave]}</b> son los días con más gente</>}
            {horaPico.valor > 0 && <> y la hora más concurrida es de <b>{horaPico.clave} a {Number(horaPico.clave) + 1} h</b></>}.
            {franjaPico && <> La franja más llena fue el <b>{franjaPico}</b>.</>}
            {ind.excepciones?.valor > 0 && (
              <> Recepción autorizó <b>{numero(ind.excepciones.valor)} {ind.excepciones.valor === 1 ? 'ingreso' : 'ingresos'} por excepción</b>.</>
            )}
          </span>
        </p>
      )}

      {graficos && (
        // Como en Ganancias: lo que va en el tiempo ocupa dos tercios y las partes de un todo, el tercio de al lado.
        // Abajo, hora del día y día de la semana van mitad y mitad
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
          <TarjetaGrafico version={version} className="lg:col-span-6 xl:col-span-4" titulo="Visitas por día"
            subtitulo={`Promedio: ${decimal(ind.promedioDiario.valor)} por día abierto`}
            tabla={{ columnas: ['Fecha', 'Visitas'], filas: datos.visitasPorDia.map(d => [fechaLarga(d.clave), numero(d.valor)]) }}>
            <GraficoLinea datos={datos.visitasPorDia} alto={180} descripcion="Visitas por día"
              formatoValor={(v) => `${numero(v)} ${v === 1 ? 'visita' : 'visitas'}`} />
          </TarjetaGrafico>
          <TarjetaGrafico version={version} className="lg:col-span-6 xl:col-span-2 flex flex-col" titulo="Edades" subtitulo="Socios distintos que vinieron"
            tabla={{ columnas: ['Edad', 'Socios'], filas: datos.edades.map(d => [d.clave, numero(d.valor)]) }}>
            {hayVisitas ? (
              <GraficoDona datos={datos.edades} colores={COLORES_EDAD} descripcion="Socios por rango de edad" textoTotal="Socios"
                formatoValor={(v) => numero(v)} tamanio={168} />
            ) : <SinDatos />}
          </TarjetaGrafico>
          <TarjetaGrafico version={version} className="lg:col-span-3" titulo="Hora del día" subtitulo="Destacada la hora pico"
            tabla={{ columnas: ['Hora', 'Visitas'], filas: datos.visitasPorHora.filter(d => d.valor > 0).map(d => [`${d.clave} a ${Number(d.clave) + 1} h`, numero(d.valor)]) }}>
            {hayVisitas ? (
              <GraficoColumnas datos={horasDelDia} alto={160} cadaCuantasEtiquetas={3}
                descripcion="Visitas por hora del día" formatoValor={(v) => `${numero(v)} visitas`}
                detalle={(d) => `De ${d.clave} a ${Number(d.clave) + 1} h`} />
            ) : <SinDatos />}
          </TarjetaGrafico>
          <TarjetaGrafico version={version} className="lg:col-span-3" titulo="Día de la semana" subtitulo="Promedio de visitas"
            tabla={{ columnas: ['Día', 'Promedio'], filas: datos.promedioPorDiaSemana.map(d => [d.clave, decimal(d.valor)]) }}>
            {hayVisitas ? (
              <GraficoColumnas datos={datos.promedioPorDiaSemana} alto={160} descripcion="Promedio de visitas por día de la semana"
                formatoValor={(v) => `${decimal(v)} en promedio`} formatoEje={(v) => numero(v)}
                detalle={(d) => `Los ${DIAS_LARGOS[d.clave]}`} />
            ) : <SinDatos />}
          </TarjetaGrafico>
        </div>
      )}
    </div>
  );
};

export default MetricasSocios;
