import { useState } from 'react';
import api from '../services/api';

export default function MolineteSimulador() {
    const [dni, setDni] = useState('');
    const [mensaje, setMensaje] = useState(null);
    const [estadoAcceso, setEstadoAcceso] = useState('ESPERANDO'); // ESPERANDO, PERMITIDO, DENEGADO, ALERTA_FINANCIERA

    const simularIngreso = async (e) => {
        e.preventDefault();
        if (!dni) return;

        try {
            const respuesta = await api.post(`/acceso/intentar/${dni}`);
            
            if (respuesta.data === "ACCESO_PERMITIDO") {
                setEstadoAcceso('PERMITIDO');
                setMensaje('¡Bienvenido a SUMMIT!');

                // Limpiar input y volver a estado neutral
                setDni('');
                setTimeout(() => {
                    setEstadoAcceso('ESPERANDO');
                    setMensaje(null);
                }, 3000);
            }
        } catch (error) {
            const errorData = error.response?.data;
            const status = error.response?.status;

            if (typeof errorData === 'string' && errorData.includes("BLOQUEO_PAGO")) {
                setEstadoAcceso('ALERTA_FINANCIERA');
                setMensaje('Cuota impaga o pago demorado. ¿Desea forzar el ingreso bajo su responsabilidad?');
                // IMPORTANTE: Aquí NO reseteamos la pantalla a los 3 segundos, 
                // porque el recepcionista necesita tiempo para leer y apretar el botón de forzar.
            } else if (typeof errorData === 'string' && errorData.includes("BLOQUEO_MEDICO")) {
                setEstadoAcceso('DENEGADO');
                setMensaje('BLOQUEO LEGAL ABSOLUTO: Apto médico vencido. Ley 5397 no cumplida.');
                setDni('');
                setTimeout(() => { setEstadoAcceso('ESPERANDO'); setMensaje(null); }, 4000);
            } else if (status === 404) {
                setEstadoAcceso('DENEGADO');
                setMensaje('Socio no encontrado en el sistema.');
                setDni('');
                setTimeout(() => { setEstadoAcceso('ESPERANDO'); setMensaje(null); }, 3000);
            } else {
                setEstadoAcceso('DENEGADO');
                setMensaje(errorData?.error || 'Error de conexión con el servidor.');
                setDni('');
                setTimeout(() => { setEstadoAcceso('ESPERANDO'); setMensaje(null); }, 3000);
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md mt-8 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Simulador de Control de Acceso</h2>
            
            <form onSubmit={simularIngreso} className="flex gap-4 mb-6">
                <input 
                    type="text" 
                    placeholder="Ingrese DNI del socio..." 
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                />
                <button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                >
                    Simular Ingreso
                </button>
            </form>

            {/* Pantalla del Molinete */}
            <div className={`p-4 rounded-lg text-center font-bold text-lg transition-colors duration-300 ${
                estadoAcceso === 'PERMITIDO' ? 'bg-green-100 text-green-800 border-2 border-green-500' :
                estadoAcceso === 'DENEGADO' ? 'bg-red-100 text-red-800 border-2 border-red-500' :
                estadoAcceso === 'ALERTA_FINANCIERA' ? 'bg-orange-100 text-orange-800 border-2 border-orange-500' :
                'bg-gray-100 text-gray-500 border-2 border-dashed border-gray-300'
            }`}>
                {mensaje ? mensaje : 'Esperando lectura de DNI...'}
            </div>

            {/* --- BOTÓN DE CONTINGENCIA --- */}
            {estadoAcceso === 'ALERTA_FINANCIERA' && (
                <div className="mt-6 animate-fade-in">
                    <button 
                        onClick={async () => {
                            try {
                                // Petición al endpoint de contingencia que creamos en el mensaje anterior
                                await api.post(`/acceso/forzar-ingreso/${dni}?idEmpleadoAuditor=Admin_1`);
                                
                                setEstadoAcceso('PERMITIDO');
                                setMensaje('Acceso forzado registrado correctamente. Barrera abierta.');
                                
                                // Limpieza post-contingencia
                                setTimeout(() => {
                                    setEstadoAcceso('ESPERANDO');
                                    setMensaje(null);
                                    setDni('');
                                }, 3000);

                            } catch (e) {
                                alert("Error al comunicarse con el servidor para forzar el ingreso.");
                            }
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg flex justify-center items-center gap-2 shadow-lg"
                    >
                        ⚠️ FORZAR INGRESO (Registrar bajo mi responsabilidad)
                    </button>
                    
                    <button
                        onClick={() => {
                            setEstadoAcceso('ESPERANDO');
                            setMensaje(null);
                            setDni('');
                        }}
                        className="w-full mt-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                        Cancelar y mantener bloqueado
                    </button>
                </div>
            )}
            
        </div>
    );
}