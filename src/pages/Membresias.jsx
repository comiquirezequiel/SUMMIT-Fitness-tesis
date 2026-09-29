import React from 'react';
import { Tag, TrendingUp, AlertTriangle, Users, Search, Plus, CreditCard, CheckCircle, XCircle } from 'lucide-react';

const PlanCard = ({ name, price, members, color }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
    <div className={`absolute top-0 left-0 w-full h-1 ${color}`}></div>
    <h3 className="text-lg font-bold text-slate-800 mb-1 mt-2">{name}</h3>
    <div className="flex items-end gap-1 mb-4">
      <span className="text-2xl font-bold text-slate-700">${price}</span>
      <span className="text-sm text-slate-500 mb-1">/mes</span>
    </div>
    <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg">
      <div className="flex items-center gap-1.5">
        <Users className="w-4 h-4 text-slate-400" />
        <span>Socios Activos</span>
      </div>
      <span className="font-semibold text-slate-800">{members}</span>
    </div>
  </div>
);

const Membresias = () => {
  const socios = [
    { id: 101, nombre: 'Juan Pérez', plan: 'Pase Libre Anual', inicio: '10/01/2026', fin: '10/01/2027', estado: 'Activo', pago: 'Al día' },
    { id: 102, nombre: 'María Gómez', plan: 'Musculación Mensual', inicio: '15/08/2026', fin: '15/09/2026', estado: 'Por Vencer', pago: 'Al día' },
    { id: 103, nombre: 'Carlos Ruiz', plan: 'Crossfit Mensual', inicio: '01/08/2026', fin: '01/09/2026', estado: 'Vencido', pago: 'Deudor' },
    { id: 104, nombre: 'Ana Torres', plan: 'Yoga Flow', inicio: '05/09/2026', fin: '05/10/2026', estado: 'Activo', pago: 'Al día' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Estado de Membresías</h1>
          <p className="text-sm text-slate-500">Gestión de planes, vencimientos y morosos</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Nuevo Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <PlanCard name="Pase Libre Anual" price="15,000" members="45" color="bg-purple-500" />
        <PlanCard name="Musculación Mensual" price="5,000" members="120" color="bg-blue-500" />
        <PlanCard name="Crossfit Mensual" price="6,500" members="35" color="bg-rose-500" />
        <PlanCard name="Yoga Flow" price="4,000" members="28" color="bg-indigo-500" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-400" /> Control de Vencimientos
          </h2>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input 
                type="text" 
                placeholder="Buscar socio..." 
                className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-shadow"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Socio</th>
                <th className="px-6 py-4">Plan Actual</th>
                <th className="px-6 py-4">Vigencia</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Pago</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {socios.map((socio) => (
                <tr key={socio.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{socio.nombre}</div>
                    <div className="text-slate-400 text-xs mt-0.5">ID: #{socio.id}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">{socio.plan}</td>
                  <td className="px-6 py-4">
                    <div className="text-slate-600">{socio.inicio} - {socio.fin}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border ${
                      socio.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      socio.estado === 'Por Vencer' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {socio.estado === 'Activo' ? <CheckCircle className="w-3 h-3" /> : 
                       socio.estado === 'Por Vencer' ? <AlertTriangle className="w-3 h-3" /> : 
                       <XCircle className="w-3 h-3" />}
                      {socio.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold ${socio.pago === 'Al día' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {socio.pago}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium text-xs hover:underline">
                      Renovar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Membresias;
