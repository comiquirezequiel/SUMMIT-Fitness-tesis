import React, { useState } from 'react';
import { 
  Users, UserPlus, UserMinus, Calendar, 
  Clock, BarChart2, TrendingUp, Filter, ChevronDown, CheckCircle, PieChart
} from 'lucide-react';

// --- Componente de tarjeta de métrica KPI ---
const KpiCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 flex justify-between items-start shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-0.5">
    <div className="flex flex-col">
      <h3 className="text-slate-500 text-[13px] font-semibold flex items-center gap-1.5 mb-2">
        {title}
      </h3>
      <p className="text-4xl font-extrabold text-slate-800 tracking-tight">{value}</p>
    </div>
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bgClass}`}>
      <Icon className={`w-5 h-5 ${colorClass}`} />
    </div>
  </div>
);

// --- Componente de barra para gráficos ---
const BarChartCol = ({ label, value, max, color = "bg-blue-500" }) => (
  <div className="flex flex-col items-center gap-2 flex-1">
    <span className="text-xs font-semibold text-slate-600">{value}</span>
    <div className="w-full max-w-[40px] bg-slate-100 rounded-t-md flex flex-col justify-end" style={{ height: '140px' }}>
      <div 
        className={`w-full ${color} rounded-t-md transition-all duration-500 hover:opacity-80`}
        style={{ height: `${max > 0 ? (value / max) * 140 : 0}px` }}
      />
    </div>
    <span className="text-[10px] sm:text-xs text-slate-500 font-medium text-center">{label}</span>
  </div>
);

const LineChartPoint = ({ label, value, max, previousValue }) => {
  return (
    <div className="flex flex-col items-center flex-1 relative group cursor-pointer">
      <div className="absolute -top-8 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
        {label}: {value} visitas
      </div>
      <div className="w-full flex justify-center items-end" style={{ height: '120px' }}>
        <div 
          className="w-2 bg-blue-400 rounded-full group-hover:bg-blue-600 transition-colors"
          style={{ height: `${max > 0 ? (value / max) * 120 : 0}px` }}
        />
      </div>
      <span className="text-[10px] text-slate-400 mt-2 rotate-45 sm:rotate-0">{label}</span>
    </div>
  );
}

const HorizontalBar = ({ label, value, max, color }) => (
  <div className="flex items-center gap-4 py-1">
    <span className="w-24 text-xs text-slate-500 text-right shrink-0">{label}</span>
    <div className="flex-1 flex items-center">
      <div 
        className={`h-5 rounded-sm ${color} transition-all`} 
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
      />
    </div>
    <span className="w-8 text-xs font-bold text-slate-700 text-right">{value}</span>
  </div>
);

const MetricasGenerales = () => {
  const [dateRange, setDateRange] = useState({ start: '2026-09-01', end: '2026-09-30' });
  const [preset, setPreset] = useState('Este mes');

  const kpis = {
    nuevos: 12, bajas: 3, totalVisitas: 845, visitantesUnicos: 210, promVisitante: 4.02, promDiario: 28.1
  };

  const asistenciaPorDia = [
    { dia: 'Lun', visitas: 145 }, { dia: 'Mar', visitas: 132 }, { dia: 'Mié', visitas: 150 },
    { dia: 'Jue', visitas: 128 }, { dia: 'Vie', visitas: 110 }, { dia: 'Sáb', visitas: 65 }, { dia: 'Dom', visitas: 15 },
  ];
  const maxDia = Math.max(...asistenciaPorDia.map(d => d.visitas));

  const asistenciaPorHora = [
    { hora: '07:00', visitas: 45 }, { hora: '08:00', visitas: 60 }, { hora: '09:00', visitas: 55 },
    { hora: '10:00', visitas: 30 }, { hora: '11:00', visitas: 25 }, { hora: '12:00', visitas: 20 },
    { hora: '13:00', visitas: 35 }, { hora: '14:00', visitas: 40 }, { hora: '15:00', visitas: 38 },
    { hora: '16:00', visitas: 50 }, { hora: '17:00', visitas: 85 }, { hora: '18:00', visitas: 110 },
    { hora: '19:00', visitas: 125 }, { hora: '20:00', visitas: 90 }, { hora: '21:00', visitas: 45 },
  ];
  const maxHora = Math.max(...asistenciaPorHora.map(d => d.visitas));

  const edadDist = [
    { label: '0-17', value: 1, color: 'bg-blue-400' },
    { label: '18-25', value: 12, color: 'bg-emerald-400' },
    { label: '26-35', value: 17, color: 'bg-amber-400' },
    { label: '36-45', value: 13, color: 'bg-rose-400' },
    { label: '46-55', value: 12, color: 'bg-indigo-400' },
    { label: '56-65', value: 1, color: 'bg-pink-400' },
    { label: '65+', value: 0, color: 'bg-slate-300' },
    { label: 'Sin datos', value: 72, color: 'bg-slate-400' }
  ];
  const maxEdad = Math.max(...edadDist.map(d => d.value));

  const sexoDist = [
    { label: 'Masculino', value: 68, color: 'bg-blue-500' },
    { label: 'Femenino', value: 57, color: 'bg-emerald-400' },
    { label: 'Sin especificar', value: 3, color: 'bg-amber-400' }
  ];
  const maxSexo = Math.max(...sexoDist.map(d => d.value));

  return (
    <div className="space-y-6 pb-10">
      {/* Header y Selector de Período */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Analítica de Socios</h1>
          <p className="text-sm text-slate-500">Métricas de asistencia y membresías según período</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center pl-2 pr-4 border-r border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
            <select 
              value={preset} 
              onChange={(e) => setPreset(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option>Hoy</option>
              <option>Últimos 7 días</option>
              <option>Este mes</option>
              <option>Mes anterior</option>
              <option>Personalizado...</option>
            </select>
          </div>
          <div className="flex items-center gap-2 px-2">
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-slate-400 text-sm">-</span>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
            Aplicar
          </button>
        </div>
      </div>

      {/* Tarjetas KPI Exclusivas del Período */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="Nuevos" value={kpis.nuevos} icon={UserPlus} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
        <KpiCard title="Bajas" value={kpis.bajas} icon={UserMinus} colorClass="text-rose-600" bgClass="bg-rose-50" />
        <KpiCard title="Total Visitas" value={kpis.totalVisitas} icon={Users} colorClass="text-blue-600" bgClass="bg-blue-50" />
        <KpiCard title="Visitantes Únicos" value={kpis.visitantesUnicos} icon={CheckCircle} colorClass="text-indigo-600" bgClass="bg-indigo-50" />
        <KpiCard title="Prom. Visitante" value={kpis.promVisitante} icon={BarChart2} colorClass="text-amber-600" bgClass="bg-amber-50" />
        <KpiCard title="Prom. Diario" value={kpis.promDiario} icon={TrendingUp} colorClass="text-purple-600" bgClass="bg-purple-50" />
      </div>

      {/* Gráficos de Asistencia */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Asistencia por día de la semana */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" /> Asistencia por día
            </h2>
          </div>
          <div className="flex items-end justify-between gap-2 h-48 mt-4">
            {asistenciaPorDia.map(d => (
              <BarChartCol key={d.dia} label={d.dia} value={d.visitas} max={maxDia} color="bg-blue-500" />
            ))}
          </div>
        </div>

        {/* Asistencia por hora */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" /> Asistencia por hora
            </h2>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              Promedio del período
            </span>
          </div>
          <div className="flex items-end justify-between gap-1 h-40 mt-4 px-2">
            {asistenciaPorHora.map((d, i) => (
              <LineChartPoint 
                key={d.hora} 
                label={d.hora} 
                value={d.visitas} 
                max={maxHora} 
                previousValue={i > 0 ? asistenciaPorHora[i-1].visitas : 0} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* Gráficos de Distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por Edad */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-slate-400" /> Distribución por Edad
            </h2>
          </div>
          <div className="space-y-1">
            {edadDist.map(item => (
              <HorizontalBar key={item.label} label={item.label} value={item.value} max={maxEdad} color={item.color} />
            ))}
          </div>
        </div>

        {/* Distribución por Sexo */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-400" /> Distribución por Sexo
            </h2>
          </div>
          <div className="space-y-1">
            {sexoDist.map(item => (
              <HorizontalBar key={item.label} label={item.label} value={item.value} max={maxSexo} color={item.color} />
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default MetricasGenerales;
