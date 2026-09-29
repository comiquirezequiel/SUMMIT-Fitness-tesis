import React, { useState } from 'react';
import { 
  QrCode, Building2, Users, UserPlus, AlertTriangle, Calendar, 
  DollarSign, CalendarCheck, ChevronLeft, ChevronRight, CalendarDays,
  Activity, Search, Clock, CheckCircle, XCircle
} from 'lucide-react';
import StatCard from '../components/StatCard';

const QuickAction = ({ icon: Icon, text, onClick }) => (
  <button onClick={onClick} className="flex-1 bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:bg-slate-50 hover:border-blue-200 transition-colors">
    <Icon className="w-5 h-5 text-blue-500" />
    <span className="font-medium text-slate-700 text-sm">{text}</span>
  </button>
);

const ActivityStat = ({ title, value, icon: Icon, color }) => {
  const colorMap = {
    blue: "text-blue-500 bg-blue-50",
    green: "text-emerald-500 bg-emerald-50",
    red: "text-red-500 bg-red-50"
  };
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 flex justify-between items-start shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-0.5">
      <div className="flex flex-col">
        <h3 className="text-slate-500 text-[13px] font-semibold flex items-center gap-1.5 mb-2">{title}</h3>
        <p className="text-4xl font-extrabold text-slate-800 tracking-tight">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
};

import CheckInModal from '../components/CheckInModal';

const Dashboard = () => {
  const [isCheckInModalOpen, setCheckInModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Dashboard</h1>
          <p className="text-sm text-slate-500">Bienvenido, Test</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCheckInModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <QrCode className="w-4 h-4" /> Escanear QR
          </button>
          <div className="flex items-center gap-2 bg-blue-50/80 px-3 py-2 rounded-lg border border-blue-100">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Summit Fitness</span>
            <span className="bg-blue-200 text-blue-800 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ml-1">ADMIN</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Socios activos" value="1" subtitle="120 total" icon="users" iconColor="text-emerald-500" iconBg="bg-emerald-50" />
        <StatCard title="Nuevos este mes" value="1" subtitle={<span className="flex gap-2 text-slate-500">Este mes <a href="#" className="text-blue-500 hover:underline">Ver detalle</a></span>} icon="user-plus" iconColor="text-blue-500" iconBg="bg-blue-50" />
        <StatCard title="Solicitudes de Baja" value="0" subtitle="Requieren seguimiento" icon="alert-triangle" iconColor="text-amber-500" iconBg="bg-amber-50" />
        <StatCard title="Asistencia hoy" value="0" subtitle="Check-ins hoy" icon="calendar" iconColor="text-blue-500" iconBg="bg-blue-50" />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Acciones rápidas</h2>
        <div className="flex gap-4">
          <QuickAction icon={UserPlus} text="Nuevo socio" onClick={() => {}} />
          <QuickAction icon={DollarSign} text="Registrar Pago" onClick={() => {}} />
          <QuickAction icon={CalendarCheck} text="Check-in" onClick={() => setCheckInModalOpen(true)} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm relative">
        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-500" /></button>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="font-semibold text-slate-800 flex items-center gap-2 justify-center text-sm">
              <Calendar className="w-4 h-4 text-slate-500" /> Hoy
            </p>
            <p className="text-xs text-emerald-500 font-medium flex items-center gap-1.5 justify-center mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> En vivo
            </p>
          </div>
          <button className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors">
            <CalendarDays className="w-4 h-4" />
          </button>
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-500" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActivityStat title="Total Hoy" value="0" icon={Users} color="blue" />
        <ActivityStat title="Permitidos" value="0" icon={CheckCircle} color="green" />
        <ActivityStat title="Denegados" value="0" icon={XCircle} color="red" />
        <ActivityStat title="Esta hora" value="0" icon={Clock} color="blue" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden min-h-[300px] flex flex-col shadow-sm">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-500" /> 
            Actividad en Vivo
            <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1"></span>
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Buscar socio..." 
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 w-[300px] transition-shadow"
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Calendar className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm font-medium">No hay check-ins</p>
        </div>
      </div>
      <CheckInModal isOpen={isCheckInModalOpen} onClose={() => setCheckInModalOpen(false)} />
    </div>
  );
};

export default Dashboard;
