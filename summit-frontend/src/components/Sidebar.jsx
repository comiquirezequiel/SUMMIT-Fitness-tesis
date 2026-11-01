import { NavLink, useLocation } from 'react-router';
import {
  Users, Wallet, Tag, Dumbbell, ClipboardList, CalendarDays, SlidersHorizontal,
  LogOut, LayoutDashboard, CheckSquare, UserX, Building2, IdCard
} from 'lucide-react';
import { usuarioActual } from '../utils/formato';
import { cerrarSesion } from '../services/auth';
import { useTareasPendientes } from '../services/seguimiento';
import { useAvisoFacturacion } from '../services/facturacion';
import { useFunciones } from '../services/funciones';

// Roles que ven cada opción (los mismos permisos que exige el backend).
// contador: globito con un número (las tareas de seguimiento pendientes; las facturas rechazadas o sin confirmar, que
// solo se cuentan con la factura electrónica prendida).
// Todas las opciones a la vista, sin grupos que haya que abrir: cada bloque es un tema (socios, caja y membresías,
// entrenamiento y clases, ajustes) y una línea fina los separa. Datos del gimnasio va abajo de todo, con Cerrar sesión.
const STAFF = ['ADMIN', 'RECEPCION'];
const TODOS = ['ADMIN', 'RECEPCION', 'PROFESOR'];
const BLOQUES = [
  [
    { icon: Users, text: 'Socios', path: '/socios', roles: TODOS },
    { icon: CheckSquare, text: 'Tareas de seguimiento', path: '/socios/tareas', roles: STAFF, contador: 'tareas' },
    { icon: UserX, text: 'Estado de socios', path: '/socios/estado', roles: STAFF },
  ],
  [
    { icon: Wallet, text: 'Caja & Pagos', path: '/caja', roles: STAFF, contador: 'facturas' },
    { icon: Tag, text: 'Membresías', path: '/planes', roles: STAFF },
  ],
  [
    { icon: ClipboardList, text: 'Rutinas', path: '/entrenamiento/rutinas', roles: ['ADMIN', 'PROFESOR'] },
    { icon: Dumbbell, text: 'Ejercicios', path: '/entrenamiento/ejercicios', roles: TODOS },
    { icon: CalendarDays, text: 'Clases', path: '/clases', roles: TODOS },
  ],
  [
    { icon: SlidersHorizontal, text: 'Configuración y reglas', path: '/ajustes/reglas', roles: STAFF },
    { icon: IdCard, text: 'Gestión de personal', path: '/ajustes/personal', roles: ['ADMIN'] },
  ],
];
const DATOS_GIMNASIO = { icon: Building2, text: 'Datos del gimnasio', path: '/ajustes/gimnasio', roles: ['ADMIN'] };

// La opción que corresponde a la pantalla abierta: la misma dirección o, si no, la más larga que la contiene
// (Nuevo socio marca "Socios"; Estado de socios se marca a sí misma)
const opcionActiva = (opciones, activePath) => opciones
  .filter(o => activePath === o.path || activePath.startsWith(`${o.path}/`))
  .sort((a, b) => b.path.length - a.path.length)[0]?.path;

const Globito = ({ cantidad }) => (
  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
    {cantidad > 99 ? '99+' : cantidad}
  </span>
);

const Opcion = ({ opcion, activa, contadores, onNavigate }) => {
  const Icono = opcion.icon;
  return (
    <NavLink to={opcion.path} onClick={onNavigate}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 tactil:min-h-11 rounded-lg text-sm transition-colors ${activa ? 'text-blue-700 bg-blue-50 font-semibold shadow-[inset_3px_0_0_#cd7f32]' : 'text-slate-700 hover:bg-slate-100'}`}>
      <Icono className={`w-4 h-4 shrink-0 ${activa ? 'text-blue-600' : 'text-slate-500'}`} />
      <span className="truncate">{opcion.text}</span>
      {opcion.contador && contadores[opcion.contador] > 0 && <Globito cantidad={contadores[opcion.contador]} />}
    </NavLink>
  );
};

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const rol = usuarioActual()?.rol;
  const { facturacion } = useFunciones();
  const avisoFacturacion = useAvisoFacturacion(facturacion && STAFF.includes(rol));
  const contadores = {
    tareas: useTareasPendientes(STAFF.includes(rol)).pendientes,
    facturas: avisoFacturacion.rechazados + avisoFacturacion.inciertos,
  };

  // Los bloques con lo que ve el rol (sin los que quedan vacíos)
  const bloques = BLOQUES.map(b => b.filter(o => o.roles.includes(rol))).filter(b => b.length > 0);
  const datosGimnasio = DATOS_GIMNASIO.roles.includes(rol) ? DATOS_GIMNASIO : null;
  const activa = opcionActiva([...bloques.flat(), ...(datosGimnasio ? [datosGimnasio] : [])], location.pathname);
  const alNavegar = () => setIsOpen(false);

  return (
    <aside
      className={`w-64 bg-white border-r border-slate-200 h-[calc(100vh-3rem)] flex flex-col fixed left-0 top-12 z-30 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {STAFF.includes(rol) && (
        <NavLink
          to="/"
          onClick={alNavegar}
          className={({isActive}) => `px-3 py-2.5 flex items-center gap-2.5 border-b border-slate-100 transition-colors ${isActive ? 'bg-blue-50/60 shadow-[inset_3px_0_0_#cd7f32]' : 'hover:bg-slate-50'}`}
        >
          <div className="w-7 h-7 bg-linear-to-br from-bordo-600 to-bordo-800 rounded-lg flex items-center justify-center shadow-xs">
            <LayoutDashboard className="w-4 h-4 text-bronce-300" />
          </div>
          <span className="font-bold text-slate-800 text-sm">Dashboard</span>
        </NavLink>
      )}

      <nav className="flex-1 overflow-y-auto p-2 sidebar-scroll" aria-label="Menú">
        {bloques.map((bloque, i) => (
          <div key={bloque[0].path} className={`flex flex-col gap-0.5 ${i > 0 ? 'mt-1.5 pt-1.5 border-t border-slate-100' : ''}`}>
            {bloque.map(o => (
              <Opcion key={o.path} opcion={o} activa={activa === o.path} contadores={contadores} onNavigate={alNavegar} />
            ))}
          </div>
        ))}
      </nav>

      {datosGimnasio && (
        <div className="px-2 pb-1">
          <Opcion opcion={datosGimnasio} activa={activa === datosGimnasio.path} contadores={contadores} onNavigate={alNavegar} />
        </div>
      )}
      <div className="p-2 border-t border-slate-200">
        <button
          onClick={() => cerrarSesion()}
          className="flex items-center gap-2.5 text-slate-600 hover:text-slate-800 text-sm font-medium w-full px-2.5 py-2 tactil:min-h-11 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
