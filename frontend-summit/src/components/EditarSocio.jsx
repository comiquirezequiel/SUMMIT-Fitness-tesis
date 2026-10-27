import { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../services/api';

export default function EditarSocio({ setVistaActual, socioSeleccionado }) {
    // Inicializamos el formulario con los datos del socio seleccionado
    const [formData, setFormData] = useState({
        nombreCompleto: '',
        email: '',
        estado: 'PENDIENTE',
        telefono: ''
    });
    const [estadoReq, setEstadoReq] = useState('ESPERANDO');
    const [mensaje, setMensaje] = useState('');

    useEffect(() => {
        if (socioSeleccionado) {
            setFormData({
                nombreCompleto: socioSeleccionado.nombreCompleto,
                email: socioSeleccionado.email,
                estado: socioSeleccionado.estado,
                telefono: socioSeleccionado.telefono || ''
            });
        }
    }, [socioSeleccionado]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const actualizarSocio = async (e) => {
        e.preventDefault();
        setEstadoReq('CARGANDO');

        try {
            await api.put(`/usuarios/${socioSeleccionado.id}`, formData);
            setEstadoReq('EXITO');
            setMensaje('Perfil actualizado correctamente.');
            
            setTimeout(() => setVistaActual('socios'), 2000);
        } catch (error) {
            setEstadoReq('ERROR');
            setMensaje(error.response?.data?.error || 'Error al intentar actualizar el socio.');
        }
    };

    if (!socioSeleccionado) return <div>Error: No se seleccionó ningún socio.</div>;

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <button 
                onClick={() => setVistaActual('socios')}
                className="flex items-center text-gray-500 hover:text-blue-600 font-semibold mb-6 transition-colors"
                disabled={estadoReq === 'CARGANDO'}
            >
                <ArrowLeft size={20} className="mr-2" /> Volver a Miembros
            </button>

            <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Editar Perfil del Socio</h2>
                    <span className="text-sm bg-gray-100 text-gray-500 py-1 px-3 rounded-full font-bold">
                        DNI: {socioSeleccionado.dni} (Inmutable)
                    </span>
                </div>
                
                {estadoReq === 'EXITO' && (
                    <div className="mb-6 p-4 bg-green-100 text-green-800 font-bold rounded-lg border border-green-300">
                        {mensaje} Redirigiendo...
                    </div>
                )}

                {estadoReq === 'ERROR' && (
                    <div className="mb-6 p-4 bg-red-100 text-red-800 font-bold rounded-lg border border-red-300">
                        {mensaje}
                    </div>
                )}

                <form onSubmit={actualizarSocio} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre Completo</label>
                            <input required type="text" name="nombreCompleto" value={formData.nombreCompleto} onChange={handleChange} 
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                disabled={estadoReq === 'CARGANDO'} />
                        </div>
                        
                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Correo Electrónico</label>
                            <input required type="email" name="email" value={formData.email} onChange={handleChange} 
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                disabled={estadoReq === 'CARGANDO'} />
                        </div>
                        
                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Teléfono</label>
                            <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} 
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                disabled={estadoReq === 'CARGANDO'} />
                        </div>

                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Estado del Socio</label>
                            <select name="estado" value={formData.estado} onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                disabled={estadoReq === 'CARGANDO'}
                            >
                                <option value="PENDIENTE">PENDIENTE</option>
                                <option value="ACTIVO">ACTIVO</option>
                                <option value="INACTIVO">INACTIVO</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={estadoReq === 'CARGANDO'} 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg flex items-center gap-2 disabled:opacity-50">
                            <Save size={20} /> {estadoReq === 'CARGANDO' ? 'Actualizando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}