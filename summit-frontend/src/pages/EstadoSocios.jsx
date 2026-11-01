import { CalendarClock, UserX } from 'lucide-react';
import Encabezado, { DentroDePestana } from '../components/Encabezado';
import Pestanas, { usePestana } from '../components/Pestanas';
import EstadoMembresias from './EstadoMembresias';
import Inactividad from './Inactividad';

const PESTANAS = [
  { id: 'membresias', texto: 'Membresías', icon: CalendarClock },
  { id: 'inactividad', texto: 'Inactividad', icon: UserX },
];

/**
 * Estado de socios: en un solo lugar, las membresías vencidas o por vencer (para renovarlas) y los socios con la
 * cuota al día que dejaron de venir (para escribirles). Antes eran Membresías > Estado de Membresías y
 * Socios > Inactividad: sus direcciones viejas llegan a la pestaña que corresponde (?vista=inactividad).
 */
const EstadoSocios = () => {
  const [pestana, setPestana] = usePestana(PESTANAS.map(p => p.id));
  return (
    <div className="space-y-3">
      <Encabezado titulo="Estado de socios" icono={UserX}
        subtitulo="A quién conviene contactar: membresías vencidas o por vencer y socios que dejaron de venir" />
      <Pestanas pestanas={PESTANAS} activa={pestana} onCambiar={setPestana} />
      <DentroDePestana>
        {pestana === 'membresias' ? <EstadoMembresias /> : <Inactividad />}
      </DentroDePestana>
    </div>
  );
};

export default EstadoSocios;
