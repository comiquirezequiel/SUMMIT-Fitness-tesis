import React from 'react';
import { Wallet, TrendingUp, TrendingDown, Calendar, Search, Plus, Filter, Download } from 'lucide-react';

const StatCard = ({ title, amount, icon: Icon, type }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">${amount}</h3>
    </div>
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
      type === 'income' ? 'bg-emerald-50 text-emerald-600' :
      type === 'expense' ? 'bg-rose-50 text-rose-600' :
      'bg-blue-50 text-blue-600'
    }`}>
      <Icon className="w-6 h-6" />
    </div>
  </div>
);

const Caja = () => {
  const transacciones = [
    { id: 1, fecha: '10 Sep 2026', hora: '10:30', socio: 'Juan Pérez', concepto: 'Pase Libre Anual', metodo: 'MercadoPago', monto: 15000, tipo: 'ingreso', estado: 'Aprobado' },
    { id: 2, fecha: '10 Sep 2026', hora: '09:15', socio: 'María Gómez', concepto: 'Musculación Mensual', metodo: 'Efectivo', monto: 5000, tipo: 'ingreso', estado: 'Aprobado' },
    { id: 3, fecha: '09 Sep 2026', hora: '18:45', socio: 'Carlos Ruiz', concepto: 'Crossfit Mensual', metodo: 'Transferencia', monto: 6500, tipo: 'ingreso', estado: 'Pendiente' },
    { id: 4, fecha: '09 Sep 2026', hora: '14:20', socio: '-', concepto: 'Mantenimiento Equipos', metodo: 'Transferencia', monto: 12000, tipo: 'egreso', estado: 'Completado' },
    { id: 5, fecha: '09 Sep 2026', hora: '11:10', socio: 'Ana Torres', concepto: 'Clase Suelta Yoga', metodo: 'Efectivo', monto: 1500, tipo: 'ingreso', estado: 'Aprobado' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Caja y Pagos</h1>
          <p className="text-sm text-slate-500">Gestión de ingresos, egresos y facturación</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo Movimiento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Ingresos Hoy" amount="21,500" icon={TrendingUp} type="income" />
        <StatCard title="Egresos Hoy" amount="12,000" icon={TrendingDown} type="expense" />
        <StatCard title="Balance Total (Mes)" amount="458,200" icon={Wallet} type="balance" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800">Últimos Movimientos</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input 
                type="text" 
                placeholder="Buscar por socio o concepto..." 
                className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-shadow"
              />
            </div>
            <button className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Fecha y Hora</th>
                <th className="px-6 py-4">Concepto / Socio</th>
                <th className="px-6 py-4">Método</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transacciones.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-slate-700">{tx.fecha}</div>
                    <div className="text-slate-400 text-xs flex items-center gap-1 mt-0.5"><Calendar className="w-3 h-3" /> {tx.hora}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{tx.concepto}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{tx.socio}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                      {tx.metodo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${
                      tx.estado === 'Aprobado' || tx.estado === 'Completado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {tx.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold ${tx.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.tipo === 'ingreso' ? '+' : '-'}${tx.monto.toLocaleString('es-AR')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-sm text-slate-500">
          <span>Mostrando 5 de 145 movimientos</span>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-slate-200 rounded hover:bg-white transition-colors disabled:opacity-50" disabled>Anterior</button>
            <button className="px-3 py-1 border border-slate-200 rounded hover:bg-white transition-colors">Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Caja;
