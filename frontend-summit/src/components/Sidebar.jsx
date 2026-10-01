import { useState } from 'react';
import { LayoutDashboard, Users, QrCode, Menu, ChevronLeft, LogOut, Settings, CreditCard, Dumbbell, CalendarDays, Wallet, BarChart3, UserPlus, MessageSquare, ClipboardList, Tag, Layers } from 'lucide-react';

export default function Sidebar({ vistaActual, setVistaActual }) {
    const [expandido, setExpandido] = useState(true);

    const menuItems = [
        { id: 'dashboard', label: 'Tablero Gerencial', icon: LayoutDashboard },
        { id: 'qr', label: 'Control Acceso QR', icon: QrCode },
        { id: 'socios', label: 'Gestión de Socios', icon: Users },
        { id: 'nuevo-socio', label: 'Nuevo Socio', icon: UserPlus },
        { id: 'caja', label: 'Caja y Pagos', icon: Wallet },
        { id: 'planes', label: 'Planes', icon: Tag },
        { id: 'membresias', label: 'Membresías', icon: CreditCard },
        { id: 'estado-membresias', label: 'Estado Membresías', icon: Layers },
        { id: 'metricas-planes', label: 'Métricas Planes', icon: BarChart3 },
        { id: 'entrenamiento', label: 'Entrenamiento', icon: Dumbbell },
        { id: 'entrenamiento-hoy', label: 'Entrenamiento Hoy', icon: CalendarDays },
        { id: 'entrenamiento-historial', label: 'Historial', icon: CalendarDays },
        { id: 'entrenamiento-rutinas', label: 'Rutinas', icon: Dumbbell },
        { id: 'clases', label: 'Clases', icon: CalendarDays },
        { id: 'chat', label: 'Chat', icon: MessageSquare },
        { id: 'tareas-crm', label: 'Tareas CRM', icon: ClipboardList },
        { id: 'metricas-generales', label: 'Métricas Generales', icon: BarChart3 },
        { id: 'constructor-rutinas', label: 'Constructor Rutinas', icon: Dumbbell },
        { id: 'config', label: 'Configuraciones', icon: Settings },
    ];

    return (
        <div className={`bg-gray-200 dark:bg-gray-900 border-r border-gray-300 dark:border-gray-800 text-gray-800 dark:text-gray-100 transition-all duration-300 flex flex-col ${expandido ? 'w-64' : 'w-20'} min-h-screen sticky top-0`}>
            {/* Cabecera del Sidebar */}
            <div className="p-4 flex justify-between items-center border-b border-gray-300 dark:border-gray-800 min-h-18">
                {expandido && <span className="font-extrabold text-xl tracking-widest text-blue-600 dark:text-blue-400">SUMMIT</span>}
                <button 
                    onClick={() => setExpandido(!expandido)} 
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors mx-auto"
                >
                    {expandido ? <ChevronLeft size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Navegación */}
            <nav className="flex-1 p-4 space-y-3 overflow-y-auto">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const activo = vistaActual === item.id;
                    
                    return (
                        <button
                            key={item.id}
                            onClick={() => setVistaActual(item.id)}
                            title={!expandido ? item.label : ""}
                            className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 overflow-hidden ${
                                activo ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-800 hover:text-white'
                            }`}
                        >
                            <Icon size={24} className="min-w-6" />
                            <span className={`ml-4 font-semibold whitespace-nowrap transition-opacity duration-300 ${expandido ? 'opacity-100' : 'opacity-0 hidden'}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </nav>

            {/* Botón de Salir (Abajo) */}
            <div className="p-4 border-t border-gray-300 dark:border-gray-800">
                <button className="w-full flex items-center p-3 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-colors">
                    <LogOut size={24} className="min-w-6" />
                    <span className={`ml-4 font-semibold whitespace-nowrap ${expandido ? 'block' : 'hidden'}`}>Cerrar Sesión</span>
                </button>
            </div>
        </div>
    );
}
