import { useState } from 'react';
import api from '../services/api';

export default function MolineteSimulador() {
    const [dni, setDni] = useState('');
    const [mensaje, setMensaje] = useState(null);
    const [estadoAcceso, setEstadoAcceso] = useState('ESPERANDO'); // ESPERANDO, PERMITIDO, DENEGADO

    const simularIngreso = async (e) => {
        e.preventDefault();
        if (!dni) return;

        try {
            const respuesta = await api.post(`/acceso/intentar/${dni}`);
            
            if (respuesta.data === "ACCESO_PERMITIDO") {
                setEstadoAcceso('PERMITIDO');
                setMensaje('¡Bienvenido a SUMMIT!');
            }
        } catch (error) {
            const errorData = error.response?.data;
            const status = error.response?.status;

            if (typeof errorData === 'string' && errorData.includes("BLOQUEO_PAGO")) {
                setEstadoAcceso('ALERTA_FINANCIERA');
                setMensaje('Cuota impaga o pago demorado. ¿Desea forzar el ingreso bajo su responsabilidad?');
            } else if (typeof errorData === 'string' && errorData.includes("BLOQUEO_MEDICO")) {
                setEstadoAcceso('DENEGADO');
                setMensaje('BLOQUEO LEGAL ABSOLUTO: Apto médico vencido. Ley 5397 no cumplida.');
            } else if (status === 404) {
                setEstadoAcceso('DENEGADO');
                setMensaje('Socio no encontrado en el sistema.');
            } else {
                setEstadoAcceso('DENEGADO');
                setMensaje(errorData?.error || 'Error de conexión con el servidor.');
            }
        }

        // Limpiar el input para el siguiente socio
        setDni('');
        
        // Volver a estado neutral después de 3 segundos
        setTimeout(() => {
            setEstadoAcceso('ESPERANDO');
            setMensaje(null);
        }, 3000);
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
                'bg-gray-100 text-gray-500 border-2 border-dashed border-gray-300'
            }`}>
                {mensaje ? mensaje : 'Esperando lectura de DNI...'}
            </div>

            
            
        </div>
    );
}