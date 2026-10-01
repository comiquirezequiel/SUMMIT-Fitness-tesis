import React, { useState, useEffect } from 'react';
import { QrCode, Building2, Users, UserPlus, AlertTriangle, Calendar, DollarSign, CalendarCheck, ChevronLeft, ChevronRight, CalendarDays, Activity, Search, Clock, CheckCircle, XCircle } from 'lucide-react';
import StatCard from '../components/StatCard';
import CheckInModal from '../components/CheckInModal';
import api from '../services/api';

const QuickAction = ({ icon: Icon, text, onClick }) => (
  <button onClick={onClick} className="flex-1 min-w-[140px] max-w-[200px] bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-gray-700 hover:border-blue-200 dark:hover:border-blue-500 transition-colors">
    <Icon className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0" />
    <span className="font-medium text-slate-700 dark:text-gray-200 text-sm truncate">{text}</span>
  </button>
);

const ActivityStat = ({ title, value, icon: Icon, color }) => {
  const colorMap = {
    blue: "text-blue-500 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30",
    green: "text-emerald-500 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30",
    red: "text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-900/30"
  };
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-slate-200 dark:border-gray-700 flex justify-between items-start shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-0.5">
      <div className="flex flex-col min-w-0">
        <h3 className="text-slate-500 dark:text-gray-400 text-[13px] font-semibold flex items-center gap-1.5 mb-2">{title}</h3>
        <p className="text-4xl font-extrabold text-slate-800 dark:text-gray-100 tracking-tight">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
};

const Dashboard = ({ setVistaActual }) => {
  const [isCheckInModalOpen, setCheckInModalOpen] = useState(false);
  const [stats, setStats] = useState({
    sociosActivos: 0,
    nuevosEsteMes: 0,
    solicitudesBaja: 0,
    asistenciaHoy: 0,
    totalHoy: 0,
    permitidos: 0,
    denegados: 0,
    estaHora: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/dashboard/metricas');
        const data = response.data;
        setStats({
          sociosActivos: data.totalSociosActivos || 0,
          nuevosEsteMes: data.nuevosEsteMes || 0,
          solicitudesBaja: data.solicitudesDeBaja || 0,
          asistenciaHoy: data.asistenciasHoy || 0,
          totalHoy: data.totalHoy || 0,
          permitidos: data.permitidos || 0,
          denegados: data.denegados || 0,
          estaHora: data.estaHora || 0,
        });
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100 mb-1">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">Bienvenido, Test</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setCheckInModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm shrink-0"
          >
            <QrCode className="w-4 h-4" /> Escanear QR
          </button>
          <div className="flex items-center gap-2 bg-blue-50/80 dark:bg-blue-900/30 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Summit Fitness</span>
            <span className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ml-1">ADMIN</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Socios activos" value={loading ? "..." : stats.sociosActivos} subtitle="Total registrados" icon="users" iconColor="text-emerald-500" iconBg="bg-emerald-50" />
        <StatCard title="Nuevos este mes" value={loading ? "..." : stats.nuevosEsteMes} subtitle="Este mes" icon="user-plus" iconColor="text-blue-500" iconBg="bg-blue-50" />
        <StatCard title="Solicitudes de Baja" value={loading ? "..." : stats.solicitudesBaja} subtitle="Requieren seguimiento" icon="alert-triangle" iconColor="text-amber-500" iconBg="bg-amber-50" />
        <StatCard title="Asistencia hoy" value={loading ? "..." : stats.asistenciaHoy} subtitle="Check-ins hoy" icon="calendar" iconColor="text-blue-500" iconBg="bg-blue-50" />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-3">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-4">
          <QuickAction icon={UserPlus} text="Nuevo socio" onClick={() => setVistaActual('nuevo-socio')} />
          <QuickAction icon={DollarSign} text="Registrar Pago" onClick={() => setVistaActual('caja')} />
          <QuickAction icon={CalendarCheck} text="Check-in" onClick={() => setCheckInModalOpen(true)} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between shadow-sm relative">
        <button className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0"><ChevronLeft className="w-5 h-5 text-slate-500 dark:text-gray-400" /></button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-center">
            <p className="font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2 justify-center text-sm">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-gray-400" /> Hoy
            </p>
            <p className="text-xs text-emerald-500 font-medium flex items-center gap-1.5 justify-center mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> En vivo
            </p>
          </div>
          <button className="p-1.5 border border-slate-200 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 transition-colors shrink-0">
            <CalendarDays className="w-4 h-4" />
          </button>
        </div>
        <button className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0"><ChevronRight className="w-5 h-5 text-slate-500 dark:text-gray-400" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActivityStat title="Total Hoy" value={loading ? "..." : stats.totalHoy} icon={Users} color="blue" />
        <ActivityStat title="Permitidos" value={loading ? "..." : stats.permitidos} icon={CheckCircle} color="green" />
        <ActivityStat title="Denegados" value={loading ? "..." : stats.denegados} icon={XCircle} color="red" />
        <ActivityStat title="Esta hora" value={loading ? "..." : stats.estaHora} icon={Clock} color="blue" />
      </div>

      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden min-h-[300px] flex flex-col shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-gray-800/50">
          <h3 className="font-semibold text-slate-700 dark:text-gray-200 flex items-center gap-2 shrink-0">
            <Activity className="w-4 h-4 text-slate-500 dark:text-gray-400" />
            Actividad en Vivo
            <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1"></span>
          </h3>
          <div className="relative w-full sm:w-auto">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar socio..."
              className="w-full sm:w-[300px] pl-9 pr-4 py-2 border border-slate-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-shadow"
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-gray-600 mb-3" />
          <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">No hay check-ins</p>
        </div>
      </div>
      <CheckInModal isOpen={isCheckInModalOpen} onClose={() => setCheckInModalOpen(false)} />
    </div>
  );
};

export default Dashboard;
