import React, { useState, useEffect } from 'react';
import { CreditCard, Tag, Sparkles, Users, Plus, Search, MoreVertical, Edit, Filter, ChevronDown, Download, RefreshCw } from 'lucide-react';
import StatCard from '../components/StatCard';
import api from '../services/api';

const Planes = () => {
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlanes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/planes');
      setPlanes(response.data);
    } catch (err) {
      setError('Error al obtener planes');
      console.error('Error fetching planes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanes();
  }, []);

  const kpis = [
    { label: 'Total planes', value: planes.length, icon: 'credit-card', iconColor: 'text-blue-600', iconBg: 'bg-blue-50' },
    { label: 'Planes activos', value: planes.filter(p => p.activo !== false).length, icon: 'tag', iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50' },
    { label: 'Promocionales', value: planes.filter(p => p.promo).length, icon: 'sparkles', iconColor: 'text-purple-600', iconBg: 'bg-purple-50' },
    { label: 'Membresías Activas', value: planes.reduce((sum, p) => sum + (p.activas || 0), 0), icon: 'users', iconColor: 'text-rose-600', iconBg: 'bg-rose-50' },
  ];

  const planesFiltrados = planes.filter(plan => {
    if (!showInactive && plan.activo === false) return false;
    if (!search) return true;
    const termino = search.toLowerCase();
    return plan.nombrePlan?.toLowerCase().includes(termino);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Planes</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Gestión de planes y membresías</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg text-sm font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
            <CreditCard className="w-4 h-4" /> Métodos de pago
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo plan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <StatCard key={idx} title={kpi.label} value={kpi.value} icon={kpi.icon} iconColor={kpi.iconColor} iconBg={kpi.iconBg} />
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar planes..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-shadow"
            />
          </div>
          <Filter className="w-4 h-4 text-slate-400" />
          <button className="border border-slate-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-gray-200 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-gray-700">
            Todos los tipos
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            Mostrar inactivos
          </label>
          <button className="border border-slate-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-gray-200 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-gray-700 ml-auto">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button onClick={fetchPlanes} className="border border-slate-200 dark:border-gray-600 rounded-lg p-2.5 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 hover:text-slate-700 dark:hover:text-gray-200">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-8 text-center text-red-500 bg-red-50 dark:bg-red-900/20 font-medium rounded-xl">
          {error}
        </div>
      ) : loading ? (
        <div className="p-8 text-center text-slate-500 dark:text-gray-400">Cargando planes...</div>
      ) : planesFiltrados.length === 0 ? (
        <div className="p-8 text-center text-slate-500 dark:text-gray-400">No hay planes registrados.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {planesFiltrados.map(plan => (
            <div key={plan.idPlan} className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 dark:text-gray-600 cursor-grab">⋮⋮</span>
                  <h3 className="font-bold text-slate-800 dark:text-gray-100">{plan.nombrePlan}</h3>
                  {plan.promo && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800">
                      <Sparkles className="w-3 h-3" /> Promo
                    </span>
                  )}
                </div>
                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4">
                <span className="text-2xl font-bold text-slate-800 dark:text-gray-100">$ {plan.precioBase?.toLocaleString('es-AR')}</span>
                <span className="text-sm text-slate-400 ml-1">/ {plan.periodo || 'mes'}</span>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-gray-300 mb-4">
                <span>Membresías Activas</span>
                <span className="font-bold">{plan.activas || 0}</span>
              </div>

              <button className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg text-sm font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                <Edit className="w-4 h-4" /> Editar plan
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Planes;
