import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, Calendar, Search, Plus, Filter, Download } from 'lucide-react';
import api from '../services/api';

const StatCard = ({ title, amount, icon: Icon, type }) => (
  <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 dark:text-gray-400 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800 dark:text-gray-100">${amount}</h3>
    </div>
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
      type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
      type === 'expense' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
      'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
    }`}>
      <Icon className="w-6 h-6" />
    </div>
  </div>
);

const Caja = () => {
  const [transacciones, setTransacciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchTransacciones = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/pagos');
      setTransacciones(response.data);
    } catch (err) {
      setError('Error al obtener transacciones');
      console.error('Error fetching transacciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransacciones();
  }, []);

  const ingresosHoy = transacciones.filter(t => t.tipo === 'ingreso').reduce((sum, t) => sum + t.monto, 0);
  const egresosHoy = transacciones.filter(t => t.tipo === 'egreso').reduce((sum, t) => sum + t.monto, 0);
  const balanceTotal = ingresosHoy - egresosHoy;

  const transaccionesFiltradas = transacciones.filter(tx => {
    if (!search) return true;
    const termino = search.toLowerCase();
    return (
      tx.socio?.toLowerCase().includes(termino) ||
      tx.concepto?.toLowerCase().includes(termino)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Caja y Pagos</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">Gestión de ingresos, egresos y facturación</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo Movimiento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Ingresos Hoy" amount={ingresosHoy.toLocaleString('es-AR')} icon={TrendingUp} type="income" />
        <StatCard title="Egresos Hoy" amount={egresosHoy.toLocaleString('es-AR')} icon={TrendingDown} type="expense" />
        <StatCard title="Balance Total" amount={balanceTotal.toLocaleString('es-AR')} icon={Wallet} type="balance" />
      </div>

      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">Últimos Movimientos</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por socio o concepto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 w-full border border-slate-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-shadow"
              />
            </div>
            <button className="p-2 border border-slate-200 dark:border-gray-600 rounded-lg text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center text-red-500 bg-red-50 dark:bg-red-900/20 font-medium">
            {error}
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-gray-400">Cargando transacciones...</div>
        ) : transaccionesFiltradas.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-gray-400">No hay transacciones registradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-gray-300">
              <thead className="bg-slate-50 dark:bg-gray-800/50 text-slate-500 dark:text-gray-400 font-medium border-b border-slate-200 dark:border-gray-700 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Fecha y Hora</th>
                  <th className="px-6 py-4">Concepto / Socio</th>
                  <th className="px-6 py-4">Método</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                {transaccionesFiltradas.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-700 dark:text-gray-200">{tx.fecha}</div>
                      <div className="text-slate-400 dark:text-gray-500 text-xs flex items-center gap-1 mt-0.5"><Calendar className="w-3 h-3" /> {tx.hora}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800 dark:text-gray-100">{tx.concepto}</div>
                      <div className="text-slate-500 dark:text-gray-400 text-xs mt-0.5">{tx.socio}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 text-xs font-medium border border-slate-200 dark:border-gray-600">
                        {tx.metodo}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${
                        tx.estado === 'Aprobado' || tx.estado === 'Completado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                      }`}>
                        {tx.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${tx.tipo === 'ingreso' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {tx.tipo === 'ingreso' ? '+' : '-'}${tx.monto.toLocaleString('es-AR')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-slate-200 dark:border-gray-700 flex items-center justify-between bg-slate-50 dark:bg-gray-800/50 text-sm text-slate-500 dark:text-gray-400">
          <span>Mostrando {transaccionesFiltradas.length} de {transacciones.length} movimientos</span>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-slate-200 dark:border-gray-600 rounded hover:bg-white dark:hover:bg-gray-700 transition-colors disabled:opacity-50" disabled>Anterior</button>
            <button className="px-3 py-1 border border-slate-200 dark:border-gray-600 rounded hover:bg-white dark:hover:bg-gray-700 transition-colors">Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Caja;
