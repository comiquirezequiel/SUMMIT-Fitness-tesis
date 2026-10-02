import React, { useState } from 'react';
import { CheckCircle2, Search, Filter, Phone, MessageCircle, Mail, Users, Plus } from 'lucide-react';

const FILTER_TABS = [
  { key: 'todas', label: 'Todas', icon: Filter, active: true },
  { key: 'llamadas', label: 'Llamadas', icon: Phone },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'presencial', label: 'Presencial', icon: Users },
];

const TareasCRM = () => {
  const [activeFilter, setActiveFilter] = useState('todas');
  const [search, setSearch] = useState('');

  // Datos de ejemplo — cuando se conecte al backend se traerán las tareas reales
  const tareas = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-blue-600" /> Mis Tareas
          </h1>
          <p className="text-sm text-slate-500 mt-1">Todas tus tareas y seguimientos en un solo lugar</p>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {tareas.length} tareas pendientes
          </p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Nueva Tarea
        </button>
      </div>

      {/* Barra de búsqueda + Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por socio o notas..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-shadow"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {FILTER_TABS.map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    activeFilter === tab.key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lista de tareas / Estado vacío */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        {tareas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">¡Todo al día! 🎉</h3>
            <p className="text-sm text-slate-400 mt-1">No tenés tareas pendientes en este momento</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Las tareas se renderizarían acá */}
          </div>
        )}
      </div>
    </div>
  );
};

export default TareasCRM;
