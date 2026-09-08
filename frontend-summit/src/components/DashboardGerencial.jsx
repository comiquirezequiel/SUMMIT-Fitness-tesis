import { DollarSign, Users, Activity, UserMinus, UserPlus, Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

export default function DashboardGerencial() {
    // Estados para guardar la información
    const [metricas, setMetricas] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);

    // useEffect se ejecuta automáticamente cuando el componente aparece en pantalla
    useEffect(() => {
        const obtenerDatos = async () => {
            try {
                // Hacemos la petición GET a Spring Boot
                const respuesta = await api.get('/dashboard/metricas');
                setMetricas(respuesta.data);
                setCargando(false);
            } catch (err) {
                console.error("Error al conectar con la API:", err);
                setError("No se pudo conectar con el servidor. ¿Está Spring Boot encendido?");
                setCargando(false);
            }
        };
        obtenerDatos();
    }, []);

    // Pantalla de carga o error
    if (cargando) return <div className="p-10 text-center text-xl font-bold">Cargando métricas de SUMMIT...</div>;
    if (error) return <div className="p-10 text-center text-red-500 font-bold">{error}</div>;

    // Transformamos el objeto Map de Java { "18": 10, "19": 25 } a un Array para Recharts
    const datosGrafico = Object.entries(metricas.horasPico).map(([hora, cantidad]) => ({
        hora: `${hora}:00`,
        accesos: cantidad
    }));

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-extrabold text-gray-800 mb-8">Tablero Gerencial - SUMMIT Fitness</h1>

            {/* Grid de Tarjetas KPI */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                
                {/* 1. Ingresos del Mes */}
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500 flex items-center justify-between">
                    <div>
                        <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Ingresos del Mes</h2>
                        <p className="text-3xl font-black text-gray-800 mt-1">${metricas.ingresosDelMes.toLocaleString('es-AR')}</p>
                    </div>
                    <div className="bg-green-100 p-4 rounded-full">
                        <DollarSign className="text-green-600" size={28} />
                    </div>
                </div>

                {/* 2. Socios Activos */}
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500 flex items-center justify-between">
                    <div>
                        <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Socios Activos</h2>
                        <p className="text-3xl font-black text-gray-800 mt-1">{metricas.totalSociosActivos}</p>
                    </div>
                    <div className="bg-blue-100 p-4 rounded-full">
                        <Users className="text-blue-600" size={28} />
                    </div>
                </div>

                {/* KPI 3: Retención */}
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-purple-500 flex items-center justify-between">
                    <div>
                        <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Retención Mensual</h2>
                        <p className="text-3xl font-black text-gray-800 mt-1">{metricas.porcentajeRetencion}%</p>
                    </div>
                    <div className="bg-purple-100 p-4 rounded-full">
                        <Activity className="text-purple-600" size={28} />
                    </div>       
                </div>

                {/* 4. Solicitudes de Baja (NUEVO) */}
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-500 flex items-center justify-between">
                    <div>
                        <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Solicitudes de Baja</h2>
                        <p className="text-3xl font-black text-gray-800 mt-1">{metricas.solicitudesDeBaja}</p>
                    </div>
                    <div className="bg-red-100 p-4 rounded-full">
                        <UserMinus className="text-red-600" size={28} />
                    </div>
                </div>

                {/* 5. Nuevos este mes (NUEVO) */}
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-emerald-500 flex items-center justify-between">
                    <div>
                        <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Nuevos este mes</h2>
                        <p className="text-3xl font-black text-gray-800 mt-1">{metricas.nuevosEsteMes}</p>
                    </div>
                    <div className="bg-emerald-100 p-4 rounded-full">
                        <UserPlus className="text-emerald-600" size={28} />
                    </div>
                </div>

                {/* 6. Ingresos de hoy (NUEVO) */}
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-amber-500 flex items-center justify-between">
                    <div>
                        <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Ingresos de Hoy</h2>
                        <p className="text-3xl font-black text-gray-800 mt-1">${metricas.ingresosDeHoy.toLocaleString('es-AR')}</p>
                    </div>
                    <div className="bg-amber-100 p-4 rounded-full">
                        <Wallet className="text-amber-600" size={28} />
                    </div>
                </div>

            </div>



            {/* Gráfico de Recharts */}
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Flujo Operativo (Horas Pico)</h2>
                <div className="h-80 w-full">
                    {datosGrafico.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={datosGrafico}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="hora" />
                                <YAxis allowDecimals={false} />
                                <Tooltip cursor={{fill: '#f3f4f6'}} />
                                <Bar dataKey="accesos" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Asistencias" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-gray-400">
                            No hay datos de ingresos en el molinete para mostrar hoy.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}