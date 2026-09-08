import { Users, UserCheck, UserX, Clock, UserPlus, AlertCircle, Dumbbell, Edit, Trash2 } from 'lucide-react';

export default function GestionSocios({ setVistaActual }) {
    
    // Datos ficticios (Mock) para probar la UI
    const mockSocios = [
        { id: 1, nombre: "Juan Pérez", dni: "12345678", email: "juan@ejemplo.com", telefono: "3875123456", estado: "ACTIVO", dias: 120 },
        { id: 2, nombre: "María Gómez", dni: "87654321", email: "maria@ejemplo.com", telefono: "3875987654", estado: "PENDIENTE", dias: 0 }
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-extrabold text-gray-800">Gestión de Miembros</h1>
                <button 
                    onClick={() => setVistaActual('nuevo-socio')}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                >
                    <UserPlus size={20} /> Crear Nuevo Miembro
                </button>
            </div>

            {/* Grid de KPIs de Socios */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard titulo="Totales" valor="2" Icon={Users} color="text-gray-600" bg="bg-gray-100" border="border-gray-500" />
                <KpiCard titulo="Activos" valor="1" Icon={UserCheck} color="text-green-600" bg="bg-green-100" border="border-green-500" />
                <KpiCard titulo="Inactivos" valor="0" Icon={UserX} color="text-red-600" bg="bg-red-100" border="border-red-500" />
                <KpiCard titulo="Pendientes" valor="1" Icon={AlertCircle} color="text-amber-600" bg="bg-amber-100" border="border-amber-500" />
                <KpiCard titulo="Expira Pronto" valor="0" Icon={Clock} color="text-orange-600" bg="bg-orange-100" border="border-orange-500" />
                <KpiCard titulo="Nuevos (Mes)" valor="2" Icon={UserPlus} color="text-blue-600" bg="bg-blue-100" border="border-blue-500" />
            </div>

            {/* Tabla de Socios */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-800 text-white text-sm uppercase tracking-wider">
                            <th className="p-4 font-semibold">Nombre Completo</th>
                            <th className="p-4 font-semibold">Contacto</th>
                            <th className="p-4 font-semibold">Estado y Antigüedad</th>
                            <th className="p-4 font-semibold text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {mockSocios.map(socio => (
                            <tr key={socio.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <p className="font-bold text-gray-800">{socio.nombre}</p>
                                    <p className="text-xs text-gray-500">DNI: {socio.dni}</p>
                                </td>
                                <td className="p-4">
                                    <p className="text-sm text-gray-700">{socio.email}</p>
                                    <p className="text-xs text-gray-500">{socio.telefono}</p>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${socio.estado === 'ACTIVO' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {socio.estado}
                                    </span>
                                    <p className="text-xs text-gray-500 mt-1">{socio.dias} días en SUMMIT</p>
                                </td>
                                <td className="p-4 flex justify-center gap-3">
                                    <button disabled title="Asignar Rutina (Próximamente)" className="p-2 text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed">
                                        <Dumbbell size={18} />
                                    </button>
                                    <button title="Editar" className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                                        <Edit size={18} />
                                    </button>
                                    <button title="Eliminar" className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Sub-componente interno para las tarjetas KPI
function KpiCard({ titulo, valor, Icon, color, bg, border }) {
    return (
        <div className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${border} flex items-center justify-between`}>
            <div>
                <h2 className="text-gray-500 text-[10px] font-bold uppercase">{titulo}</h2>
                <p className="text-2xl font-black text-gray-800">{valor}</p>
            </div>
            <div className={`${bg} p-2 rounded-full`}>
                <Icon className={color} size={20} />
            </div>
        </div>
    );
}