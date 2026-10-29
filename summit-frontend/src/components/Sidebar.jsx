import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Users, User, BarChart2,
  Wallet, Tag, TrendingUp, AlertTriangle,
  Dumbbell, ClipboardList, ListChecks,
  Calendar, CalendarDays, Settings,
  LogOut, LayoutDashboard, ChevronDown, ChevronUp, Clipboard,
  CheckSquare, UserX, Repeat, Building2, BadgePercent, FileText, Receipt
} from 'lucide-react';
import { usuarioActual } from '../utils/formato';
import { cerrarSesion } from '../services/auth';
import { useTareasPendientes } from '../services/seguimiento';
import { useAvisoFacturacion } from '../services/facturacion';
import { useFunciones } from '../services/funciones';

// Roles que ven cada opción (los mismos permisos que exige el backend).
// demo: pantallas que todavía muestran datos de ejemplo (no están conectadas al backend).
// contador: globito con un número (las tareas de seguimiento pendientes, las facturas rechazadas o sin confirmar).
// soloConFacturacion: existe solo con la factura electrónica prendida.
const STAFF = ['ADMIN', 'RECEPCION'];
const MENU_ITEMS = [
  {
    icon: Users, text: "Socios",
    subItems: [
      { icon: User, text: "Lista de Socios", path: "/socios", roles: ['ADMIN', 'RECEPCION', 'PROFESOR'] },
      { icon: Dumbbell, text: "Constructor de Rutinas", path: "/rutinas/constructor", roles: ['ADMIN', 'PROFESOR'] },
      { icon: BarChart2, text: "Analítica de Socios", path: "/socios/metricas", roles: STAFF },
      { icon: CheckSquare, text: "Tareas de seguimiento", path: "/socios/tareas", roles: STAFF, contador: 'tareas' },
      { icon: UserX, text: "Inactividad", path: "/socios/inactividad", roles: STAFF },
    ]
  },
  {
    icon: Wallet, text: "Caja & Pagos",
    subItems: [
      { icon: Wallet, text: "Caja", path: "/caja", roles: STAFF },
      { icon: FileText, text: "Facturas", path: "/caja/facturas", roles: STAFF, contador: 'facturas', soloConFacturacion: true },
    ]
  },
  {
    icon: Tag, text: "Membresías",
    subItems: [
      { icon: Tag, text: "Planes", path: "/planes", roles: STAFF },
      { icon: AlertTriangle, text: "Estado de Membresías", path: "/membresias/estado", roles: STAFF },
      { icon: Repeat, text: "Débitos automáticos", path: "/membresias/debitos", roles: STAFF },
      { icon: BadgePercent, text: "Descuentos y reglas", path: "/membresias/reglas", roles: ['ADMIN'] },
      { icon: TrendingUp, text: "Métricas de Planes", path: "/membresias/metricas", roles: ['ADMIN'] },
    ]
  },
  {
    icon: Dumbbell, text: "Entrenamiento",
    subItems: [
      { icon: ListChecks, text: "Ejercicios", path: "/entrenamiento/ejercicios", roles: ['ADMIN', 'RECEPCION', 'PROFESOR'] },
      { icon: ClipboardList, text: "Rutinas", path: "/entrenamiento/rutinas", roles: ['ADMIN', 'PROFESOR'] },
    ]
  },
  {
    icon: Calendar, text: "Clases",
    subItems: [
      { icon: CalendarDays, text: "Agenda de Clases", path: "/clases", roles: ['ADMIN', 'RECEPCION', 'PROFESOR'] },
    ]
  },
  {
    icon: Settings, text: "Ajustes",
    subItems: [
      { icon: CheckSquare, text: "Reglas de Acceso", path: "/ajustes/acceso", roles: STAFF },
      { icon: Users, text: "Equipo", path: "/ajustes/equipo", roles: ['ADMIN'] },
      { icon: Building2, text: "Datos del gimnasio", path: "/ajustes/gimnasio", roles: ['ADMIN'] },
      { icon: Clipboard, text: "Asistencia del personal", path: "/ajustes/asistencia", roles: ['ADMIN'] },
      { icon: Receipt, text: "Facturación", path: "/ajustes/facturacion", roles: ['ADMIN'], soloConFacturacion: true },
    ]
  }
];

// Menú filtrado por el rol del usuario (sin lo de la facturación si está apagada): se ocultan los grupos que quedan
// vacíos
const menuParaRol = (rol, { facturacion }) => MENU_ITEMS
  .map(item => ({
    ...item,
    subItems: item.subItems.filter(sub => sub.roles.includes(rol) && (facturacion || !sub.soloConFacturacion)),
  }))
  .filter(item => item.subItems.length > 0);

const Globito = ({ cantidad }) => (
  <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
    {cantidad > 99 ? '99+' : cantidad}
  </span>
);

const SidebarItem = ({ icon: Icon, text, path, subItems, activePath, onNavigate, contadores }) => {
  const [isOpen, setIsOpen] = useState(false);

  const isActiveParent = subItems && subItems.some(sub => activePath.startsWith(sub.path));
  // Con el grupo cerrado, un punto avisa que adentro hay algo pendiente
  const pendiente = subItems && subItems.some(sub => sub.contador && contadores[sub.contador] > 0);

  useEffect(() => {
    if (isActiveParent) {
      setIsOpen(true);
    }
  }, [isActiveParent]);

  return (
    <div className="mb-1">
      {subItems ? (
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${isActiveParent ? 'text-blue-600 bg-blue-50/50 font-medium' : 'text-slate-700 hover:bg-slate-100'}`}
        >
          <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 ${isActiveParent ? 'text-blue-500' : 'text-slate-500'}`} />
            <span className="text-sm">{text}</span>
            {!isOpen && pendiente && <span className="w-2 h-2 rounded-full bg-blue-600" aria-label="Hay algo pendiente" />}
          </div>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
      ) : (
        <NavLink 
          to={path}
          onClick={onNavigate}
          className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${activePath === path ? 'text-blue-600 bg-blue-50/50 font-medium' : 'text-slate-700 hover:bg-slate-100'}`}
        >
          <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 ${activePath === path ? 'text-blue-500' : 'text-slate-500'}`} />
            <span className="text-sm">{text}</span>
          </div>
        </NavLink>
      )}
      
      {isOpen && subItems && (
        <div className="ml-5 mt-1 pl-4 border-l border-slate-200 flex flex-col gap-1">
          {subItems.map((sub, idx) => {
            const SubIcon = sub.icon;
            const isActive = activePath === sub.path;
            return (
               <NavLink 
                key={idx} 
                to={sub.path}
                onClick={onNavigate}
                className={`flex items-center gap-3 p-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <SubIcon className={`w-4 h-4 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                {sub.text}
                {sub.demo && (
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded" title="Pantalla con datos de ejemplo">
                    Demo
                  </span>
                )}
                {sub.contador && contadores[sub.contador] > 0 && <Globito cantidad={contadores[sub.contador]} />}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const rol = usuarioActual()?.rol;
  const funciones = useFunciones();
  const { facturacion } = funciones;
  const avisoFacturacion = useAvisoFacturacion(facturacion && STAFF.includes(rol));
  const contadores = {
    tareas: useTareasPendientes(STAFF.includes(rol)).pendientes,
    facturas: avisoFacturacion.rechazados + avisoFacturacion.inciertos,
  };

  return (
    <aside 
      className={`w-64 bg-white border-r border-slate-200 h-[calc(100vh-3.5rem)] flex flex-col fixed left-0 top-14 z-30 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {STAFF.includes(rol) && (
        <NavLink
          to="/"
          onClick={() => setIsOpen(false)}
          className={({isActive}) => `p-3.5 flex items-center gap-3 border-b border-slate-100 transition-colors ${isActive ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
        >
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-blue-600" />
          </div>
          <span className="font-bold text-slate-800 text-sm">Dashboard</span>
        </NavLink>
      )}

      <div className="flex-1 overflow-y-auto p-3 sidebar-scroll">
        {menuParaRol(rol, funciones).map((item, idx) => (
          <SidebarItem 
            key={idx} 
            icon={item.icon} 
            text={item.text} 
            path={item.path}
            subItems={item.subItems} 
            activePath={location.pathname}
            onNavigate={() => setIsOpen(false)}
            contadores={contadores}
          />
        ))}
      </div>
      
      <div className="p-3 border-t border-slate-200">
        <button
          onClick={() => cerrarSesion()}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 text-sm font-medium w-full p-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
