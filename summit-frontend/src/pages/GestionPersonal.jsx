import { Users, Clipboard, IdCard } from 'lucide-react';
import Encabezado, { DentroDePestana } from '../components/Encabezado';
import Pestanas, { usePestana, usePanelPestanas } from '../components/Pestanas';
import AjustesEquipo from './AjustesEquipo';
import AjustesAsistencia from './AjustesAsistencia';

const PESTANAS = [
  { id: 'equipo', texto: 'Equipo', icon: Users },
  { id: 'asistencia', texto: 'Asistencia', icon: Clipboard },
];

/**
 * Gestión de personal (solo admin): quiénes forman el equipo y sus horas. Antes eran Ajustes > Equipo y
 * Ajustes > Asistencia del personal; las direcciones viejas llegan a su pestaña.
 */
const GestionPersonal = () => {
  const [pestana, setPestana] = usePestana(PESTANAS.map(p => p.id));
  // Las pestañas ya vistas quedan armadas y el panel no salta al cambiar
  const { panel, estilo, abierta, cambiar } = usePanelPestanas(pestana, setPestana);
  return (
    <div className="space-y-3">
      <Encabezado titulo="Gestión de personal" icono={IdCard}
        subtitulo="El equipo que usa el sistema y sus entradas, salidas y horas trabajadas" />
      <Pestanas pestanas={PESTANAS} activa={pestana} onCambiar={cambiar} />
      <div ref={panel} style={estilo}>
        <DentroDePestana>
          {abierta('equipo') && <div hidden={pestana !== 'equipo'}><AjustesEquipo /></div>}
          {abierta('asistencia') && <div hidden={pestana !== 'asistencia'}><AjustesAsistencia /></div>}
        </DentroDePestana>
      </div>
    </div>
  );
};

export default GestionPersonal;
