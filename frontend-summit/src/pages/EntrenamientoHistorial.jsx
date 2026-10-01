import React, { useState, useEffect } from 'react';
import { History, User, ChevronsUpDown } from 'lucide-react';
import api from '../services/api';

const EntrenamientoHistorial = () => {
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSocios = async () => {
      try {
        const response = await api.get('/usuarios');
        setSocios(response.data);
      } catch (err) {
        console.error('Error fetching socios:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSocios();
  }, []);

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Historial de Entrenamientos</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">Consulta el historial de entrenamientos completados</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">
          <User className="w-4 h-4 text-slate-500 dark:text-gray-400" /> Seleccionar Socio
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar socio..."
            className="w-full p-2.5 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-slate-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
          />
          <ChevronsUpDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col items-center justify-center p-12 min-h-[300px]">
        <User className="w-10 h-10 text-slate-400 mb-4" />
        <p className="text-slate-800 font-semibold mb-1">Selecciona un socio</p>
        <p className="text-slate-500 text-sm">Elige un socio para ver su historial de entrenamientos</p>
      </div>
    </div>
  );
};

export default EntrenamientoHistorial;
