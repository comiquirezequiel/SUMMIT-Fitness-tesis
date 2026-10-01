import React, { useState, useEffect } from 'react';
import { Tag, TrendingUp, AlertTriangle, Users, Search, Plus, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

const PlanCard = ({ name, price, members, color }) => (
  <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
    <div className={`absolute top-0 left-0 w-full h-1 ${color}`}></div>
    <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-1 mt-2">{name}</h3>
    <div className="flex items-end gap-1 mb-4">
      <span className="text-2xl font-bold text-slate-700 dark:text-gray-200">${price}</span>
      <span className="text-sm text-slate-500 dark:text-gray-400 mb-1">/mes</span>
    </div>
    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-gray-300 bg-slate-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
      <div className="flex items-center gap-1.5">
        <Users className="w-4 h-4 text-slate-400" />
        <span>Socios Activos</span>
      </div>
      <span className="font-semibold text-slate-800 dark:text-gray-100">{members}</span>
    </div>
  </div>
);

const Membresias = () => {
  const [socios, setSocios] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sociosRes, planesRes] = await Promise.all([
        api.get('/socios'),
        api.get('/planes')
      ]);
      setSocios(sociosRes.data);
      setPlanes(planesRes.data);
    } catch (err) {
      setError('Error al obtener datos');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const sociosFiltrados = socios.filter(socio => {
    if (!search) return true;
    const termino = search.toLowerCase();
    return socio.nombreCompleto?.toLowerCase().includes(termino);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Estado de Membresías</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">Gestión de planes, vencimientos y morosos</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Nuevo Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {planes.slice(0, 4).map((plan, idx) => (
          <PlanCard
            key={plan.idPlan}
            name={plan.nombrePlan}
            price={plan.precioBase?.toLocaleString('es-AR') || '0'}
            members={plan.activas || 0}
            color={['bg-purple-500', 'bg-blue-500', 'bg-rose-500', 'bg-indigo-500'][idx % 4]}
          />
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden mt-6">
        <div className="p-5 border-b border-slate-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-400" /> Control de Vencimientos
          </h2>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar socio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 w-full border border-slate-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-shadow"
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center text-red-500 bg-red-50 dark:bg-red-900/20 font-medium">
            {error}
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-gray-400">Cargando membresías...</div>
        ) : sociosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-gray-400">No hay socios registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-gray-300">
              <thead className="bg-slate-50 dark:bg-gray-800/50 text-slate-500 dark:text-gray-400 font-medium border-b border-slate-200 dark:border-gray-700 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Socio</th>
                  <th className="px-6 py-4">Plan Actual</th>
                  <th className="px-6 py-4">Vigencia</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Pago</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                {sociosFiltrados.map((socio) => (
                  <tr key={socio.idSocio} className="hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 dark:text-gray-100">{socio.nombreCompleto}</div>
                      <div className="text-slate-400 dark:text-gray-500 text-xs mt-0.5">ID: #{socio.idSocio}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-gray-200">{socio.planActual}</td>
                    <td className="px-6 py-4">
                      <div className="text-slate-600 dark:text-gray-300">{socio.vencimientoMembresia || 'Sin fecha'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border ${
                        socio.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                        socio.estado === 'PENDIENTE' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
                        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
                      }`}>
                        {socio.estado === 'ACTIVO' ? <CheckCircle className="w-3 h-3" /> :
                         socio.estado === 'PENDIENTE' ? <AlertTriangle className="w-3 h-3" /> :
                         <XCircle className="w-3 h-3" />}
                        {socio.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold ${socio.membresiaAlDia ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {socio.membresiaAlDia ? 'Al día' : 'Vencida'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-xs hover:underline">
                        Renovar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Membresias;
