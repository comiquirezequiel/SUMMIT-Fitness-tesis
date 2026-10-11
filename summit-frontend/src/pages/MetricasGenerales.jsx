import React, { useState, useEffect } from 'react';
import { LogIn, Users, Repeat, UserCheck, UserPlus, UserMinus, Sparkles } from 'lucide-react';
import { apiFetch } from '../services/api';
import {
  SERIES, SIN_DATO, numero, fechaLarga, TarjetaKpi, TarjetaGrafico, SinDatos, FiltroPeriodo, periodoInicial,
} from '../components/graficos/base';
import { GraficoLinea, GraficoColumnas, MapaCalor, GraficoBarras, BarraApilada } from '../components/graficos/Graficos';

const DIAS_LARGOS = { Lun: 'lunes', Mar: 'martes', Mié: 'miércoles', Jue: 'jueves', Vie: 'viernes', Sáb: 'sábados', Dom: 'domingos' };
const DIAS_CELDA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
// Color fijo por categoría (el color sigue a la categoría aunque cambie el período)
const COLORES_GENERO = {
  Masculino: SERIES[0], Femenino: SERIES[1], 'No binario': SERIES[2], 'Prefiero no decirlo': SERIES[3], 'Sin dato': SIN_DATO,
};

const decimal = (n) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Analítica de Socios: asistencia real (ingresos permitidos por el control de acceso) y perfil de quienes vienen.
 * Todo se compara con el período anterior del mismo largo.
 */
const MetricasGenerales = () => {
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    apiFetch(`/metricas/socios?desde=${periodo.desde}&hasta=${periodo.hasta}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'No se pudieron cargar las métricas');
        if (vigente) { setDatos(json); setError(''); }
      })
      .catch(err => vigente && setError(err.message))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [periodo.desde, periodo.hasta]);

  const ind = datos?.indicadores || {};
  const hayVisitas = (ind.visitas?.valor || 0) > 0;

  // Lo más destacado, dicho en palabras
  let franjaPico = null;
  if (datos?.mapaCalor?.length) {
    const pico = datos.mapaCalor.reduce((a, b) => (b.visitas > a.visitas ? b : a));
    franjaPico = `${DIAS_CELDA[pico.dia]} de ${pico.hora} a ${pico.hora + 1} h`;
  }
  const diaPico = datos?.promedioPorDiaSemana?.reduce((a, b) => (b.valor > a.valor ? b : a));
  const horaPico = datos?.visitasPorHora?.reduce((a, b) => (b.valor > a.valor ? b : a));
  // Horas desde las 6 (o antes, si alguien vino más temprano): las etiquetas caen en 6, 9, 12...
  const primeraHora = datos ? datos.visitasPorHora.findIndex(d => d.valor > 0) : -1;
  const horasDelDia = datos ? datos.visitasPorHora.slice(Math.min(6, primeraHora < 0 ? 6 : primeraHora)) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Analítica de Socios</h1>
          <p className="text-sm text-slate-500">
            Asistencia y perfil de quienes vienen al gimnasio
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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <TarjetaKpi titulo="Visitas" icon={LogIn} valor={ind.visitas.valor} anterior={ind.visitas.anterior} />
            <TarjetaKpi titulo="Socios que vinieron" icon={Users} valor={ind.visitantesUnicos.valor} anterior={ind.visitantesUnicos.anterior} />
            <TarjetaKpi titulo="Visitas por socio" icon={Repeat} valor={ind.promedioPorVisitante.valor}
              anterior={ind.promedioPorVisitante.anterior} formato={decimal} />
            <TarjetaKpi titulo="Socios activos" icon={UserCheck} valor={ind.sociosActivos.valor} anterior={ind.sociosActivos.anterior}
              detalle="Con la membresía al día" />
            <TarjetaKpi titulo="Socios nuevos" icon={UserPlus} valor={ind.nuevos.valor} anterior={ind.nuevos.anterior} />
            <TarjetaKpi titulo="Bajas" icon={UserMinus} valor={ind.bajas.valor} anterior={ind.bajas.anterior} subirEsBueno={false}
              detalle="Membresías vencidas sin renovar" />
          </div>

          {hayVisitas && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-white border border-blue-100 text-sm text-slate-700">
              <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
              <p>
                En promedio vienen <b>{decimal(ind.promedioDiario.valor)} personas por día</b>.
                {diaPico && diaPico.valor > 0 && <> Los <b>{DIAS_LARGOS[diaPico.clave]}</b> son los días con más gente</>}
                {horaPico && horaPico.valor > 0 && <> y la hora más concurrida es de <b>{horaPico.clave} a {Number(horaPico.clave) + 1} h</b></>}.
                {franjaPico && <> La franja más llena del período fue el <b>{franjaPico}</b>.</>}
                {ind.excepciones?.valor > 0 && (
                  <> Recepción autorizó <b>{numero(ind.excepciones.valor)} {ind.excepciones.valor === 1 ? 'ingreso' : 'ingresos'} por excepción</b>.</>
                )}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TarjetaGrafico className="lg:col-span-2" titulo="Visitas por día"
              subtitulo={`Promedio: ${decimal(ind.promedioDiario.valor)} por día`}
              tabla={{ columnas: ['Fecha', 'Visitas'], filas: datos.visitasPorDia.map(d => [fechaLarga(d.clave), numero(d.valor)]) }}>
              <GraficoLinea datos={datos.visitasPorDia} descripcion="Visitas por día"
                formatoValor={(v) => `${numero(v)} ${v === 1 ? 'visita' : 'visitas'}`} />
            </TarjetaGrafico>
            <TarjetaGrafico titulo="Día de la semana" subtitulo="Promedio de visitas · destacado el día con más gente"
              tabla={{ columnas: ['Día', 'Promedio'], filas: datos.promedioPorDiaSemana.map(d => [d.clave, decimal(d.valor)]) }}>
              {hayVisitas ? (
                <GraficoColumnas datos={datos.promedioPorDiaSemana} alto={260} descripcion="Promedio de visitas por día de la semana"
                  formatoValor={(v) => `${decimal(v)} en promedio`} formatoEje={(v) => numero(v)}
                  detalle={(d) => `Los ${DIAS_LARGOS[d.clave]}`} />
              ) : <SinDatos />}
            </TarjetaGrafico>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TarjetaGrafico className="lg:col-span-2" titulo="Horarios pico" subtitulo="Visitas por día y hora: cuanto más oscuro, más gente"
              tabla={{
                columnas: ['Franja', 'Visitas'],
                filas: [...datos.mapaCalor].sort((a, b) => b.visitas - a.visitas)
                  .map(c => [`${DIAS_CELDA[c.dia]} ${c.hora} a ${c.hora + 1} h`, numero(c.visitas)]),
              }}>
              {hayVisitas ? <MapaCalor celdas={datos.mapaCalor} descripcion="Mapa de calor de visitas por día y hora" /> : <SinDatos />}
            </TarjetaGrafico>
            <TarjetaGrafico titulo="Hora del día" subtitulo="Total de visitas por hora · destacada la hora pico"
              tabla={{ columnas: ['Hora', 'Visitas'], filas: datos.visitasPorHora.filter(d => d.valor > 0).map(d => [`${d.clave} a ${Number(d.clave) + 1} h`, numero(d.valor)]) }}>
              {hayVisitas ? (
                <GraficoColumnas datos={horasDelDia} alto={250} cadaCuantasEtiquetas={3}
                  descripcion="Visitas por hora del día" formatoValor={(v) => `${numero(v)} visitas`}
                  detalle={(d) => `De ${d.clave} a ${Number(d.clave) + 1} h`} />
              ) : <SinDatos />}
            </TarjetaGrafico>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TarjetaGrafico titulo="Edad de quienes vinieron" subtitulo="Socios distintos que ingresaron en el período"
              tabla={{ columnas: ['Edad', 'Socios'], filas: datos.edades.map(d => [d.clave, numero(d.valor)]) }}>
              {hayVisitas ? (
                <GraficoBarras datos={datos.edades} colores={{ 'Sin dato': SIN_DATO }} descripcion="Socios por rango de edad"
                  formatoValor={(v) => numero(v)} />
              ) : <SinDatos />}
            </TarjetaGrafico>
            <TarjetaGrafico titulo="Género de quienes vinieron" subtitulo="Socios distintos que ingresaron en el período"
              tabla={{ columnas: ['Género', 'Socios'], filas: datos.generos.map(d => [d.clave, numero(d.valor)]) }}>
              {hayVisitas ? (
                <BarraApilada datos={datos.generos} colores={COLORES_GENERO} descripcion="Socios por género"
                  formatoValor={(v) => `${numero(v)} ${v === 1 ? 'socio' : 'socios'}`} />
              ) : <SinDatos />}
            </TarjetaGrafico>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricasGenerales;
