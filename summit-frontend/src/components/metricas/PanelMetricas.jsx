import { useState } from 'react';
import { Users, Tag, TrendingUp, ChartColumn } from 'lucide-react';
import Pestanas, { usePestana, usePanelPestanas } from '../Pestanas';
import { botonHerramienta } from '../Campo';
import { FiltroPeriodo, periodoInicial } from '../graficos/base';
import MetricasSocios from './MetricasSocios';
import MetricasMembresias from './MetricasMembresias';
import MetricasGanancias from './MetricasGanancias';
import { usuarioActual } from '../../utils/formato';

// Ganancias usa /metricas/ingresos, que el backend solo le contesta al admin
const PESTANAS = [
  { id: 'socios', texto: 'Socios', icon: Users },
  { id: 'planes', texto: 'Planes / Membresías', icon: Tag },
  { id: 'ganancias', texto: 'Ganancias', icon: TrendingUp, soloAdmin: true },
];

// Preferencia de cada computadora: si los gráficos se ven abiertos o solo la fila de indicadores
const CLAVE_GRAFICOS = 'summit.tablero.graficos';
const leerGraficos = (porDefecto) => {
  try {
    const guardado = localStorage.getItem(CLAVE_GRAFICOS);
    return guardado === null ? porDefecto : guardado === '1';
  } catch {
    return porDefecto;
  }
};
const guardarGraficos = (valor) => {
  try {
    localStorage.setItem(CLAVE_GRAFICOS, valor ? '1' : '0');
  } catch {
    // sin almacenamiento (ventana privada): vale solo mientras la pantalla está abierta
  }
};

/**
 * Métricas del tablero en un solo contenedor con pestañas (como Caja y Pagos): Socios (asistencia, horarios pico,
 * edades y género), Planes / Membresías (planes más usados, estado de las membresías y débitos automáticos) y
 * Ganancias (ingresos y cómo se cobra, solo el admin). Cada pestaña muestra su fila de indicadores y, abajo, sus
 * gráficos. El período vale para Socios y Ganancias; Planes / Membresías es la foto de hoy.
 * Va debajo del control de acceso y la actividad en vivo. Los gráficos se ven de entrada y se pueden ocultar; la
 * elección queda guardada en la computadora.
 */
const PanelMetricas = () => {
  const esAdmin = usuarioActual()?.rol === 'ADMIN';
  const pestanas = PESTANAS.filter(p => esAdmin || !p.soloAdmin);
  const [pestana, setPestana] = usePestana(pestanas.map(p => p.id), 'metricas');
  // Las pestañas ya vistas quedan armadas (siguen el período elegido), entran suave y el panel no se achica mientras
  // carga otra
  const { panel, estilo, abierta, cambiar } = usePanelPestanas(pestana, setPestana);
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [graficos, setGraficos] = useState(() => leerGraficos(true));

  const alternarGraficos = () => {
    setGraficos(!graficos);
    guardarGraficos(!graficos);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs" aria-label="Métricas">
      <Pestanas pestanas={pestanas} activa={pestana} onCambiar={cambiar} className="px-2">
        {pestana !== 'planes' && <FiltroPeriodo valor={periodo} onChange={setPeriodo} />}
        <button type="button" onClick={alternarGraficos} aria-expanded={graficos} className={botonHerramienta}>
          <ChartColumn className="w-3.5 h-3.5" /> {graficos ? 'Ocultar gráficos' : 'Ver gráficos'}
        </button>
      </Pestanas>
      <div ref={panel} style={estilo} className="p-2.5 bg-slate-50/60 rounded-b-xl" role="tabpanel">
        {abierta('socios') && <div hidden={pestana !== 'socios'} className="entra-suave"><MetricasSocios periodo={periodo} graficos={graficos} /></div>}
        {abierta('planes') && <div hidden={pestana !== 'planes'} className="entra-suave"><MetricasMembresias graficos={graficos} /></div>}
        {abierta('ganancias') && <div hidden={pestana !== 'ganancias'} className="entra-suave"><MetricasGanancias periodo={periodo} graficos={graficos} /></div>}
      </div>
    </section>
  );
};

export default PanelMetricas;
