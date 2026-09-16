import { useState, useEffect } from 'react';
import { Users, UserCheck, UserX, Clock, UserPlus, AlertCircle, Dumbbell, Edit, Trash2, Activity, Wallet, Search } from 'lucide-react';
import api from '../services/api';

export default function GestionSocios({ setVistaActual, setSocioSeleccionado }) {
    // Estado para guardar los socios reales de la base de datos
    const [socios, setSocios] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState(''); // Lo que el usuario teclea
    const [busquedaDebounced, setBusquedaDebounced] = useState(''); // Lo que realmente usamos para filtrar

    // Función para ir a buscar los datos a Spring Boot
    const cargarSocios = async () => {
        try {
            const respuesta = await api.get('/usuarios');
            setSocios(respuesta.data);
        } catch (error) {
            console.error("Error al obtener la lista de socios:", error);
        } finally {
            setCargando(false);
        }
    };

    // useEffect se ejecuta una sola vez cuando el componente aparece en pantalla
    useEffect(() => {
        cargarSocios();
    }, []);

    //DEBOUNCE 500ms
    useEffect(() => {
        const timer = setTimeout(() => {
            setBusquedaDebounced(busqueda);
        }, 500); // Medio segundo de espera

        return () => clearTimeout(timer);
    }, [busqueda]);


    // Función para eliminar un socio
    const handleEliminar = async (id, nombre) => {
        // Pequeña barrera de seguridad antes de borrar
        if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${nombre}? Esta acción no se puede deshacer.`)) {
            try {
                await api.delete(`/usuarios/${id}`);
                // Actualizamos la tabla visualmente sacando al socio borrado (sin recargar la página)
                setSocios(socios.filter(socio => socio.id !== id));
            } catch (error) {
                alert(error.response?.data?.error || "Error al intentar eliminar el socio.");
            }
        }
    };

    // Función matemática para calcular cuántos días pasaron desde la fechaRegistro
    const calcularDiasEnSummit = (fechaRegistro) => {
        if (!fechaRegistro) return 0;
        const fechaInicio = new Date(fechaRegistro);
        const hoy = new Date();
        const diferenciaMilisegundos = hoy.getTime() - fechaInicio.getTime();
        return Math.floor(diferenciaMilisegundos / (1000 * 3600 * 24)); // Convertimos a días
    };

    const sociosFiltrados = socios.filter(socio => {
        if (!busquedaDebounced) return true;
        
        const termino = busquedaDebounced.toLowerCase();
        return (
            socio.nombreCompleto?.toLowerCase().includes(termino) ||
            socio.dni?.toLowerCase().includes(termino) ||
            socio.email?.toLowerCase().includes(termino) ||
            socio.telefono?.toLowerCase().includes(termino)
        );
    });

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

            {/* Grid de KPIs de Socios (Dejamos los valores estáticos por ahora hasta hacer el endpoint de métricas específico) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard titulo="Totales" valor={socios.length} Icon={Users} color="text-gray-600" bg="bg-gray-100" border="border-gray-500" />
                <KpiCard titulo="Activos" valor={socios.filter(s => s.estado === 'ACTIVO').length} Icon={UserCheck} color="text-green-600" bg="bg-green-100" border="border-green-500" />
                <KpiCard titulo="Inactivos" valor={socios.filter(s => s.estado === 'INACTIVO').length} Icon={UserX} color="text-red-600" bg="bg-red-100" border="border-red-500" />
                <KpiCard titulo="Pendientes" valor={socios.filter(s => s.estado === 'PENDIENTE').length} Icon={AlertCircle} color="text-amber-600" bg="bg-amber-100" border="border-amber-500" />
                <KpiCard titulo="Expira Pronto" valor={socios.filter(s => s.expiraPronto).length} Icon={Clock} color="text-orange-600" bg="bg-orange-100" border="border-orange-500" />
                <KpiCard titulo="Nuevos (Mes)" valor={socios.filter(s => new Date(s.fechaRegistro).getMonth() === new Date().getMonth()).length} Icon={UserPlus} color="text-blue-600" bg="bg-blue-100" border="border-blue-500" />
            </div>

            {/* Buscador de Socios */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                <Search className="text-gray-400" size={24} />
                <input 
                    type="text" 
                    placeholder="Buscar por nombre, DNI, email o teléfono..." 
                    className="w-full border-none outline-none text-gray-700 bg-transparent"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />
            </div>

            {/* Tabla de Socios Conectada a MySQL */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 min-h-[300px]">
                {cargando ? (
                    <div className="flex justify-center items-center h-48 text-gray-500 font-bold">
                        Cargando base de datos...
                    </div>
                ) : sociosFiltrados.length === 0 ? ( // CAMBIO ACÁ
                    <div className="flex justify-center items-center h-48 text-gray-500">
                        {busquedaDebounced ? 'No se encontraron resultados para tu búsqueda.' : 'No hay socios registrados.'}
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        {/* ... (<thead> igual) ... */}
                        <tbody className="divide-y divide-gray-200">
                            {sociosFiltrados.map(socio => ( // CAMBIO ACÁ
                                <tr key={socio.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-gray-800">{socio.nombreCompleto}</p>
                                            
                                            {/* ALERTAS VISUALES */}
                                            <div className="flex gap-1">
                                                {socio.alertaPago && (
                                                    <span title="Alerta Financiera: Cuota impaga o plan vencido" className="text-amber-500 cursor-help">
                                                        <Wallet size={16} />
                                                    </span>
                                                )}
                                                {socio.alertaMedico && (
                                                    <span title="Alerta Legal: Apto médico vencido o no presentado" className="text-red-500 cursor-help">
                                                        <Activity size={16} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500">DNI: {socio.dni}</p>
                                    </td>
                                    <td className="p-4">
                                        <p className="text-sm text-gray-700">{socio.email}</p>
                                        <p className="text-xs text-gray-500">{socio.telefono || 'Sin teléfono'}</p>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                                            socio.estado === 'ACTIVO' ? 'bg-green-100 text-green-700' : 
                                            socio.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' : 
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {socio.estado}
                                        </span>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {calcularDiasEnSummit(socio.fechaRegistro)} días en SUMMIT
                                        </p>
                                    </td>
                                    <td className="p-4 flex justify-center gap-3">
                                        <button disabled title="Asignar Rutina (Próximamente)" className="p-2 text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed">
                                            <Dumbbell size={18} />
                                        </button>
                                        
                                        <button 
                                            onClick={() => {
                                                setSocioSeleccionado(socio);
                                                setVistaActual('editar-socio');
                                            }}
                                            title="Editar" 
                                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        
                                        {/* Botón de Eliminar */}
                                        <button 
                                            onClick={() => handleEliminar(socio.id, socio.nombreCompleto)}
                                            title="Eliminar" 
                                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
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