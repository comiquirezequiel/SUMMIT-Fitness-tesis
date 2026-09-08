import { useState } from 'react';
import api from '../services/api';

export default function GestorCertificados() {
    const [dni, setDni] = useState('');
    const [estado, setEstado] = useState('ESPERANDO'); // ESPERANDO, EXITO, ERROR
    const [mensaje, setMensaje] = useState('');

    const habilitarSocio = async (e) => {
        e.preventDefault();
        if (!dni) return;

        try {
            const respuesta = await api.post(`/certificados/simular/${dni}`);
            setEstado('EXITO');
            setMensaje(`¡Socio Habilitado! ${respuesta.data}`);
        } catch (error) {
            setEstado('ERROR');
            setMensaje(error.response?.data || 'Error al procesar el certificado');
        }

        setDni('');
        setTimeout(() => {
            setEstado('ESPERANDO');
            setMensaje('');
        }, 4000);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Simulador de Auditoría Médica</h2>
                <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-1 rounded-full border border-purple-200">
                    Módulo IA (Próximamente)
                </span>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
                Ingresá el DNI de un socio bloqueado. Esto simulará la carga de un PDF y su validación instantánea por 365 días.
            </p>

            <form onSubmit={habilitarSocio} className="flex gap-4">
                <input 
                    type="text" 
                    placeholder="DNI del socio..." 
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                />
                <button 
                    type="submit" 
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                >
                    Aprobar Apto Médico
                </button>
            </form>

            {mensaje && (
                <div className={`mt-4 p-3 rounded-lg text-center font-semibold ${
                    estado === 'EXITO' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'
                }`}>
                    {mensaje}
                </div>
            )}
        </div>
    );
}