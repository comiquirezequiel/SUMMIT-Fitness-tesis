import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Download, Search, Filter, MessageCircle, Phone, Mail, ArrowUpDown, Clock, ChevronDown } from 'lucide-react';

const SEVERITY_FILTERS = [
  { key: 'todos', label: 'Todos', color: 'bg-blue-600 text-white border-blue-600' },
  { key: 'leve', label: 'Leve', dot: 'bg-yellow-400' },
  { key: 'media', label: 'Media', dot: 'bg-orange-500' },
  { key: 'alta', label: 'Alta', dot: 'bg-rose-500' },
];

const Inactividad = () => {
  const [activeFilter, setActiveFilter] = useState('todos');
  const [minDays, setMinDays] = useState(7);

  const kpis = [
    { label: 'Alerta Leve', tooltip: '7-14 días', value: 0, range: '7-14 días', iconColor: 'text-yellow-500', bgIcon: 'bg-yellow-50', borderColor: 'border-yellow-200' },
    { label: 'Alerta Media', tooltip: '15-29 días', value: 1, range: '15-29 días', iconColor: 'text-orange-500', bgIcon: 'bg-orange-50', borderColor: 'border-orange-200' },
    { label: 'Alerta Alta', tooltip: '30+ días', value: 62, range: '30+ días', iconColor: 'text-rose-500', bgIcon: 'bg-rose-50', borderColor: 'border-rose-200' },
    { label: 'Retención', tooltip: 'Últimos 7 días', value: '0%', range: 'Últimos 7 días', iconColor: 'text-blue-500', bgIcon: 'bg-blue-50', borderColor: 'border-blue-200' },
  ];

  const members = [
    { id: 1, name: 'Matías Pérez', code: 'XXXDGRDZ', avatar: null, severity: 'ALTA', days: 280, date: '03/12/2025', avgWeek: '0.0/sem', avg90d: '0 en 90d', membership: '-' },
    { id: 2, name: 'Natalia López', code: '4GEW59E3', avatar: null, severity: 'ALTA', days: 280, date: '03/12/2025', avgWeek: '0.0/sem', avg90d: '0 en 90d', membership: '-' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" /> Alertas de Inactividad
          </h1>
          <p className="text-sm text-slate-500 mt-1">Socios que no han asistido recientemente</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className={`bg-white p-5 rounded-xl border shadow-sm ${kpi.borderColor}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-500 flex items-center gap-1">
                {kpi.label}
                <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-400 cursor-help">?</span>
              </p>
              <div className={`w-10 h-10 rounded-full ${kpi.bgIcon} flex items-center justify-center`}>
                {idx === 0 && <Clock className={`w-5 h-5 ${kpi.iconColor}`} />}
                {idx === 1 && <AlertTriangle className={`w-5 h-5 ${kpi.iconColor}`} />}
                {idx === 2 && <AlertTriangle className={`w-5 h-5 ${kpi.iconColor}`} />}
                {idx === 3 && (
                  <svg className={`w-5 h-5 ${kpi.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                )}
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800">{kpi.value}</p>
            <p className="text-xs text-slate-400 mt-1">{kpi.range}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">Filtros:</span>
          {SEVERITY_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                activeFilter === f.key
                  ? (f.color || 'bg-blue-600 text-white border-blue-600')
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.dot && <span className={`w-2 h-2 rounded-full ${f.dot}`}></span>}
              {f.label}
            </button>
          ))}
          <span className="text-sm text-slate-500 ml-4">Mínimo:</span>
          <select
            value={minDays}
            onChange={(e) => setMinDays(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-blue-400"
          >
            <option value={7}>7 días</option>
            <option value={15}>15 días</option>
            <option value={30}>30 días</option>
            <option value={60}>60 días</option>
          </select>
        </div>
        <span className="text-sm text-slate-500">{members.length} encontrados</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">
                  <span className="flex items-center gap-1 cursor-pointer hover:text-slate-700">Socio <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-6 py-4 font-medium">
                  <span className="flex items-center gap-1 cursor-pointer hover:text-slate-700">Inactividad <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-6 py-4 font-medium">
                  <span className="flex items-center gap-1 cursor-pointer hover:text-slate-700">Promedio <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-6 py-4 font-medium">
                  <span className="flex items-center gap-1 cursor-pointer hover:text-slate-700">Membresía <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                        {m.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-semibold text-blue-600 hover:underline cursor-pointer">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      m.severity === 'ALTA' ? 'bg-rose-100 text-rose-700' :
                      m.severity === 'MEDIA' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {m.severity}
                    </span>
                    <p className="text-sm font-bold text-slate-800 mt-1">{m.days} días</p>
                    <p className="text-xs text-slate-400">{m.date}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-700">{m.avgWeek}</p>
                    <p className="text-xs text-slate-400">{m.avg90d}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{m.membership}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors" title="WhatsApp">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors" title="Llamar">
                        <Phone className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors" title="Email">
                        <Mail className="w-4 h-4" />
                      </button>
                    </div>
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

export default Inactividad;
