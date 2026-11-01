import { ShieldCheck, Receipt, SlidersHorizontal } from 'lucide-react';
import Encabezado, { DentroDePestana, DentroDeSeccion } from '../components/Encabezado';
import Pestanas, { usePestana, usePanelPestanas } from '../components/Pestanas';
import ConfiguracionAcceso from './ConfiguracionAcceso';
import { ReglasMembresia, Descuentos } from './DescuentosReglas';
import AjustesFacturacion from './AjustesFacturacion';
import { useFunciones } from '../services/funciones';
import { useAvisoFacturacion } from '../services/facturacion';
import { usuarioActual } from '../utils/formato';

// Reglas: las de acceso (recepción las ve sin cambiarlas) y, abajo, las de membresía y los descuentos (solo el admin).
// Facturación es del admin y solo con la factura electrónica prendida (el globito avisa las facturas rechazadas o sin
// confirmar).
const PESTANAS = [
  { id: 'reglas', texto: 'Reglas', icon: ShieldCheck, roles: ['ADMIN', 'RECEPCION'] },
  { id: 'facturacion', texto: 'Facturación', icon: Receipt, roles: ['ADMIN'], soloConFacturacion: true },
];

/**
 * Configuración y reglas: un solo panel para lo que antes estaba repartido en Ajustes > Reglas de Acceso,
 * Membresías > Descuentos y reglas y Ajustes > Facturación. Los descuentos van dentro de Reglas, al final. Las direcciones viejas llegan a su pestaña.
 */
const ConfiguracionReglas = () => {
  const rol = usuarioActual()?.rol;
  const esAdmin = rol === 'ADMIN';
  const { facturacion } = useFunciones();
  const aviso = useAvisoFacturacion(facturacion && esAdmin);
  const pestanas = PESTANAS
    .filter(p => p.roles.includes(rol) && (facturacion || !p.soloConFacturacion))
    .map(p => (p.id === 'facturacion' ? { ...p, contador: aviso.rechazados + aviso.inciertos, alerta: aviso.rechazados > 0 } : p));
  const [pestana, setPestana] = usePestana(pestanas.map(p => p.id));
  // Las pestañas ya vistas quedan armadas (con lo que se estaba escribiendo) y el panel no salta al cambiar
  const { panel, estilo, abierta, cambiar } = usePanelPestanas(pestana, setPestana);

  return (
    <div className="space-y-3">
      <Encabezado titulo="Configuración y reglas" icono={SlidersHorizontal}
        subtitulo="Reglas de acceso y de membresía, descuentos y factura electrónica" />
      {pestanas.length > 1 && <Pestanas pestanas={pestanas} activa={pestana} onCambiar={cambiar} />}
      <div ref={panel} style={estilo}>
        {/* Reglas: primero las de acceso, abajo las de membresía y al final los descuentos, cada una con su título */}
        {abierta('reglas') && (
          <div hidden={pestana !== 'reglas'}>
            <DentroDeSeccion>
              <div className="space-y-5">
                <ConfiguracionAcceso />
                {esAdmin && <div className="pt-4 border-t border-slate-200"><ReglasMembresia /></div>}
                {esAdmin && <div className="pt-4 border-t border-slate-200"><Descuentos /></div>}
              </div>
            </DentroDeSeccion>
          </div>
        )}
        <DentroDePestana>
          {abierta('facturacion') && <div hidden={pestana !== 'facturacion'}><AjustesFacturacion /></div>}
        </DentroDePestana>
      </div>
    </div>
  );
};

export default ConfiguracionReglas;
