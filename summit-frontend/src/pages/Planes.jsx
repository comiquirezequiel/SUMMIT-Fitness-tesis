import React, { useState } from 'react';
import { CreditCard, Tag, Sparkles, Users, Plus, Search, MoreVertical, Edit, Filter, ChevronDown, Download, RefreshCw } from 'lucide-react';
import StatCard from '../components/StatCard';

const Planes = () => {
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const kpis = [
    { label: 'Total planes', value: 10, icon: CreditCard, iconColor: 'text-blue-600', iconBg: 'bg-blue-50' },
    { label: 'Planes activos', value: 9, icon: Tag, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50' },
    { label: 'Planes promocionales', value: 1, icon: Sparkles, iconColor: 'text-purple-600', iconBg: 'bg-purple-50' },
    { label: 'Membresías Activas', value: 1, icon: Users, iconColor: 'text-rose-600', iconBg: 'bg-rose-50' },
  ];

  const planes = [
    { id: 1, name: 'Musculación mensual', promo: true, price: 38000, period: '1 mes', activas: 23 },
    { id: 2, name: 'Musculación Mensual', promo: false, price: 15000, period: '1 mes', activas: 37 },
    { id: 3, name: 'Musculación Trimestral', promo: false, price: 40000, period: '3 meses', activas: 33, monthlyPrice: 13333 },
    { id: 4, name: 'Crossfit Mensual', promo: false, price: 6500, period: '1 mes', activas: 15 },
    { id: 5, name: 'Yoga Flow', promo: false, price: 4000, period: '1 mes', activas: 7 },
    { id: 6, name: 'Pase Libre Anual', promo: false, price: 15000, period: '1 mes', activas: 3 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Planes</h1>
          <p className="text-sm text-slate-500 mt-1">Gestión de planes y membresías</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <CreditCard className="w-4 h-4" /> Métodos de pago
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo plan
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total planes" value="10" icon="credit-card" iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Planes activos" value="9" icon="tag" iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Promocionales" value="1" icon="sparkles" iconColor="text-purple-600" iconBg="bg-purple-50" />
        <StatCard title="Membresías Activas" value="1" icon="users" iconColor="text-rose-600" iconBg="bg-rose-50" />
      </div>

      {/* Barra de búsqueda */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar planes..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-shadow"
            />
          </div>
          <Filter className="w-4 h-4 text-slate-400" />
          <button className="border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 flex items-center gap-2 hover:bg-slate-50">
            Todos los tipos
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Mostrar inactivos
          </label>
          <button className="border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 flex items-center gap-2 hover:bg-slate-50 ml-auto">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button className="border border-slate-200 rounded-lg p-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid de Planes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {planes.map(plan => (
          <div key={plan.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-slate-300 cursor-grab">⋮⋮</span>
                <h3 className="font-bold text-slate-800">{plan.name}</h3>
                {plan.promo && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                    <Sparkles className="w-3 h-3" /> Promo
                  </span>
                )}
              </div>
              <button className="text-slate-400 hover:text-slate-600">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4">
              <span className="text-2xl font-bold text-slate-800">$ {plan.price.toLocaleString('es-AR')}</span>
              <span className="text-sm text-slate-400 ml-1">/ {plan.period}</span>
            </div>

            {plan.monthlyPrice && (
              <p className="text-xs text-slate-400 -mt-3 mb-4">Precio mensual: $ {plan.monthlyPrice.toLocaleString('es-AR')}</p>
            )}

            <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
              <span>Membresías Activas</span>
              <span className="font-bold">{plan.activas}</span>
            </div>

            <button className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              <Edit className="w-4 h-4" /> Editar plan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Planes;
