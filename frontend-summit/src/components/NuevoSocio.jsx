import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../services/api';

export default function NuevoSocio({ setVistaActual }) {
    const [formData, setFormData] = useState({
        nombre: '', apellido: '', dni: '', email: '', telefono: ''
    });
    const [estado, setEstado] = useState('ESPERANDO'); // ESPERANDO, CARGANDO, EXITO, ERROR
    const [mensaje, setMensaje] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const guardarSocio = async (e) => {
        e.preventDefault();
        setEstado('CARGANDO');

        try {
            await api.post('/usuarios/nuevo', formData);
            setEstado('EXITO');
            setMensaje('Socio guardado correctamente en estado PENDIENTE.');
            
            // Redirigir a la tabla después de 2 segundos
            setTimeout(() => setVistaActual('socios'), 2000);
        } catch (error) {
            setEstado('ERROR');
            setMensaje(error.response?.data?.error || 'Error al intentar guardar el socio.');
        }
    };

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <button 
                onClick={() => setVistaActual('socios')}
                className="flex items-center text-gray-500 hover:text-blue-600 font-semibold mb-6 transition-colors"
                disabled={estado === 'CARGANDO'}
            >
                <ArrowLeft size={20} className="mr-2" /> Volver a Miembros
            </button>

            <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Alta de Nuevo Miembro</h2>
                
                {estado === 'EXITO' && (
                    <div className="mb-6 p-4 bg-green-100 text-green-800 font-bold rounded-lg border border-green-300">
                        {mensaje} Redirigiendo...
                    </div>
                )}

                {estado === 'ERROR' && (
                    <div className="mb-6 p-4 bg-red-100 text-red-800 font-bold rounded-lg border border-red-300">
                        {mensaje}
                    </div>
                )}

                <form onSubmit={guardarSocio} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre</label>
                            <input required type="text" name="nombre" value={formData.nombre} onChange={handleChange} 
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                disabled={estado === 'CARGANDO'} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Apellido</label>
                            <input required type="text" name="apellido" value={formData.apellido} onChange={handleChange} 
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                disabled={estado === 'CARGANDO'} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">DNI</label>
                            <input required type="text" name="dni" value={formData.dni} onChange={handleChange} 
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                disabled={estado === 'CARGANDO'} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Teléfono</label>
                            <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} 
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                disabled={estado === 'CARGANDO'} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Correo Electrónico</label>
                            <input required type="email" name="email" value={formData.email} onChange={handleChange} 
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                disabled={estado === 'CARGANDO'} />
                        </div>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-amber-800 text-sm font-semibold">
                        Nota: El usuario se creará en estado "Pendiente". Deberá regularizar su pago y certificado médico en el Tablero Gerencial para activarse.
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={estado === 'CARGANDO'} 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg flex items-center gap-2 disabled:opacity-50">
                            <Save size={20} /> {estado === 'CARGANDO' ? 'Guardando...' : 'Guardar Registro'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}