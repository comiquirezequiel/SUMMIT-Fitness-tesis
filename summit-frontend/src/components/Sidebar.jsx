import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Users, User, UserPlus, BarChart2,
  Wallet, Tag, TrendingUp, AlertTriangle,
  Dumbbell, CalendarCheck, History, ClipboardList, ListChecks,
  Calendar, CalendarDays, BookOpen, Settings,
  LogOut, LayoutDashboard, ChevronDown, ChevronUp, GitBranch, Clipboard,
  MessageCircle, CheckSquare, UserX, Home, ScanLine
} from 'lucide-react';
import { usuarioActual } from '../utils/formato';

// Roles que ven cada opción (los mismos permisos que exige el backend).
// demo: pantallas que todavía muestran datos de ejemplo (no están conectadas al backend).
const STAFF = ['ADMIN', 'RECEPCION'];
const MENU_ITEMS = [
  {
    icon: Users, text: "Socios",
    subItems: [
      { icon: User, text: "Lista de Socios", path: "/socios", roles: ['ADMIN', 'RECEPCION', 'PROFESOR'] },
      { icon: Dumbbell, text: "Constructor de Rutinas", path: "/rutinas/constructor", roles: ['ADMIN', 'PROFESOR'] },
      { icon: MessageCircle, text: "Chat", path: "/socios/chat", roles: STAFF, demo: true },
      { icon: CheckSquare, text: "Tareas CRM", path: "/socios/tareas", roles: STAFF, demo: true },
      { icon: UserX, text: "Inactividad", path: "/socios/inactividad", roles: STAFF, demo: true },
    ]
  },
  {
    icon: Wallet, text: "Caja & Pagos",
    subItems: [
      { icon: Wallet, text: "Caja", path: "/caja", roles: STAFF },
    ]
  },
  {
    icon: Tag, text: "Membresías",
    subItems: [
      { icon: Tag, text: "Planes", path: "/planes", roles: STAFF },
      { icon: AlertTriangle, text: "Estado de Membresías", path: "/membresias/estado", roles: STAFF },
      { icon: TrendingUp, text: "Métricas de Planes", path: "/membresias/metricas", roles: ['ADMIN'], demo: true },
    ]
  },
  {
    icon: Dumbbell, text: "Entrenamiento",
    subItems: [
      { icon: ListChecks, text: "Ejercicios", path: "/entrenamiento/ejercicios", roles: ['ADMIN', 'RECEPCION', 'PROFESOR'] },
      { icon: CalendarCheck, text: "Rutina de Hoy", path: "/entrenamiento/hoy", roles: ['ADMIN', 'PROFESOR'], demo: true },
      { icon: History, text: "Historial", path: "/entrenamiento/historial", roles: ['ADMIN', 'PROFESOR'], demo: true },
      { icon: ClipboardList, text: "Rutinas", path: "/entrenamiento/rutinas", roles: ['ADMIN', 'PROFESOR'], demo: true },
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
      { icon: Settings, text: "General", path: "/ajustes/general", roles: ['ADMIN'], demo: true },
      { icon: GitBranch, text: "Tablas del Sistema", path: "/ajustes/tablas", roles: ['ADMIN'], demo: true },
      { icon: Clipboard, text: "Asistencia Staff", path: "/ajustes/asistencia", roles: ['ADMIN'], demo: true },
    ]
  }
];

// Menú filtrado por el rol del usuario: se ocultan los grupos que quedan vacíos
const menuParaRol = (rol) => MENU_ITEMS
  .map(item => ({ ...item, subItems: item.subItems.filter(sub => sub.roles.includes(rol)) }))
  .filter(item => item.subItems.length > 0);

const SidebarItem = ({ icon: Icon, text, path, subItems, activePath, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const isActiveParent = subItems && subItems.some(sub => activePath.startsWith(sub.path));

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
        {menuParaRol(rol).map((item, idx) => (
          <SidebarItem 
            key={idx} 
            icon={item.icon} 
            text={item.text} 
            path={item.path}
            subItems={item.subItems} 
            activePath={location.pathname}
            onNavigate={() => setIsOpen(false)}
          />
        ))}
      </div>
      
      <div className="p-3 border-t border-slate-200">
        <button 
          onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 text-sm font-medium w-full p-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
