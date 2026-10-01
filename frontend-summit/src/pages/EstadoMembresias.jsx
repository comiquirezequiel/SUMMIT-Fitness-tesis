import React, { useState, useEffect } from 'react';
import { AlertTriangle, CalendarX, Clock, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

const TABS = [
  { id: 'vencidas', label: 'Vencidas', count: 0, icon: CalendarX, color: 'rose' },
  { id: '0-7', label: '0-7 días', count: 0, icon: AlertTriangle, color: 'orange' },
  { id: '8-15', label: '8-15 días', count: 0, icon: Clock, color: 'yellow' },
  { id: '15+', label: '15+ días', count: 1, icon: CheckCircle2, color: 'emerald' },
];

const EstadoMembresias = () => {
  const [activeTab, setActiveTab] = useState('15+');
  const [membresias, setMembresias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMembresias = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get('/membresias/estado');
        setMembresias(response.data);
      } catch (err) {
        setError('Error al obtener membresías');
        console.error('Error fetching membresias:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembresias();
  }, []);

  const getTabColors = (tab, isActive) => {
    const baseColors = {
      rose: { border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-600 dark:text-rose-400', activeBg: 'bg-rose-50 dark:bg-rose-900/30', activeBorder: 'border-rose-500' },
      orange: { border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-600 dark:text-orange-400', activeBg: 'bg-orange-50 dark:bg-orange-900/30', activeBorder: 'border-orange-500' },
      yellow: { border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-600 dark:text-yellow-400', activeBg: 'bg-yellow-50 dark:bg-yellow-900/30', activeBorder: 'border-yellow-500' },
      emerald: { border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400', activeBg: 'bg-emerald-50 dark:bg-emerald-900/30', activeBorder: 'border-emerald-500' },
    };

    const theme = baseColors[tab.color];
    if (isActive) {
      return `${theme.activeBg} ${theme.activeBorder} ${theme.text} shadow-sm`;
    }
    return `bg-white dark:bg-gray-800 ${theme.border} text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 opacity-70`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Estado de Membresías</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Gestiona membresías próximas a vencer y vencidas</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 dark:text-gray-100 mb-4">Estado de Membresías</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex justify-between items-start p-6 rounded-xl border-2 transition-all text-left ${getTabColors(tab, isActive)} ${isActive ? 'shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] -translate-y-0.5' : 'shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)]'}`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="font-semibold text-[13px]">{tab.label}</span>
                    <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px] cursor-help opacity-50">?</span>
                  </div>
                  <span className="text-4xl font-extrabold tracking-tight">{tab.count}</span>
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/50 dark:bg-gray-700/50">
                  <Icon className="w-5 h-5 opacity-90" />
                </div>
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center py-16 text-red-500">
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-gray-400">
            <p className="text-sm font-medium">Cargando membresías...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-gray-500">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-sm font-medium">No hay membresías en esta categoría</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EstadoMembresias;
