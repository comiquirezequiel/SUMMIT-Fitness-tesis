import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Building2, Users, UserPlus, UserX, AlertTriangle, Calendar,
  DollarSign, CalendarCheck, Activity, Search, Clock, CheckCircle, XCircle
} from 'lucide-react';
import StatCard from '../components/StatCard';
import ControlAcceso from '../components/ControlAcceso';
import FotoSocio from '../components/socios/FotoSocio';
import CobroRapido from '../components/socios/CobroRapido';
import { apiFetch } from '../services/api';
import { formatHora, usuarioActual } from '../utils/formato';

const QuickAction = ({ icon: Icon, text, onClick }) => (
  <button onClick={onClick} className="flex-1 min-w-[150px] bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:bg-slate-50 hover:border-blue-200 transition-colors">
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

// Etiqueta corta de cada resultado de ingreso para la tabla de actividad
const RESULTADOS = {
  PERMITIDO: { texto: 'Permitido', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DENEGADO_CUENTA_INACTIVA: { texto: 'Cuenta inactiva', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
  DENEGADO_MEMBRESIA_CONGELADA: { texto: 'Congelada', clase: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  DENEGADO_CUOTA_VENCIDA: { texto: 'Cuota vencida', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
  DENEGADO_LIMITE_SEMANAL: { texto: 'Límite semanal', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
  DENEGADO_CERTIFICADO_MEDICO: { texto: 'Apto médico', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const ACTUALIZAR_CADA_MS = 30000;

const Dashboard = () => {
  const navigate = useNavigate();
  const usuario = usuarioActual();
  const [resumen, setResumen] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cobroRapido, setCobroRapido] = useState(false);
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async () => {
    try {
      const [resResumen, resIngresos] = await Promise.all([
        apiFetch('/dashboard/resumen'),
        apiFetch('/dashboard/ingresos-hoy'),
      ]);
      if (!resResumen.ok || !resIngresos.ok) throw new Error();
      setResumen(await resResumen.json());
      setIngresos(await resIngresos.json());
      setError('');
    } catch {
      setError('No se pudieron cargar los datos del tablero.');
    }
  }, []);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, ACTUALIZAR_CADA_MS);
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  const enfocarControlAcceso = () => {
    const input = document.getElementById('control-acceso-dni');
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus();
  };

  const filtro = busqueda.trim().toLowerCase();
  const ingresosFiltrados = ingresos.filter(i =>
    !filtro || i.nombre.toLowerCase().includes(filtro) || i.dni.includes(filtro));

  const valor = (campo) => (resumen ? resumen[campo].toString() : '—');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Dashboard</h1>
          <p className="text-sm text-slate-500">Bienvenido, {usuario?.nombreCompleto || 'equipo'}</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50/80 px-3 py-2 rounded-lg border border-blue-100 self-start">
          <Building2 className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Summit Fitness</span>
          {usuario?.rol && (
            <span className="bg-blue-200 text-blue-800 text-[10px] px-1.5 py-0.5 rounded-sm uppercase font-bold tracking-wider ml-1">{usuario.rol}</span>
          )}
        </div>
      </div>

      <ControlAcceso onIngreso={cargarDatos} />
      {cobroRapido && (
        <CobroRapido onClose={() => setCobroRapido(false)} onCobrado={() => { setCobroRapido(false); cargarDatos(); }} />
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Socios activos" value={valor('sociosActivos')} subtitle={resumen ? `${resumen.sociosTotal} en total` : ''} icon={Users} iconColor="text-emerald-500" iconBg="bg-emerald-50" />
        <StatCard title="Nuevos este mes" value={valor('nuevosEsteMes')} subtitle="Altas del mes" icon={UserPlus} iconColor="text-blue-500" iconBg="bg-blue-50" />
        <StatCard title="Membresías por vencer" value={valor('membresiasPorVencer')} subtitle="En los próximos 7 días" icon={AlertTriangle} iconColor="text-amber-500" iconBg="bg-amber-50" />
        <StatCard title="Socios inactivos" value={valor('sociosInactivos')} subtitle="Bajas, suspendidos o pendientes" icon={UserX} iconColor="text-slate-500" iconBg="bg-slate-100" />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-4">
          <QuickAction icon={UserPlus} text="Nuevo socio" onClick={() => navigate('/socios/nuevo')} />
          <QuickAction icon={DollarSign} text="Cobrar cuota" onClick={() => setCobroRapido(true)} />
          <QuickAction icon={CalendarCheck} text="Registrar ingreso" onClick={enfocarControlAcceso} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActivityStat title="Ingresos hoy" value={valor('ingresosHoy')} icon={Users} color="blue" />
        <ActivityStat title="Permitidos" value={valor('permitidosHoy')} icon={CheckCircle} color="green" />
        <ActivityStat title="Denegados" value={valor('denegadosHoy')} icon={XCircle} color="red" />
        <ActivityStat title="Última hora" value={valor('ingresosUltimaHora')} icon={Clock} color="blue" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden min-h-[300px] flex flex-col shadow-xs">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 justify-between sm:items-center bg-slate-50/50">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-500" />
            Actividad en vivo
            <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1"></span>
            <span className="text-xs font-normal text-slate-400">hoy · los nuevos aparecen solos</span>
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar socio o DNI..."
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100 w-full sm:w-[300px] transition-shadow"
            />
          </div>
        </div>

        {ingresosFiltrados.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <Calendar className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm font-medium">
              {ingresos.length === 0 ? 'Todavía no hubo ingresos hoy' : 'Ningún ingreso coincide con la búsqueda'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Hora</th>
                  <th className="px-6 py-3 font-medium">Socio</th>
                  <th className="px-6 py-3 font-medium">DNI</th>
                  <th className="px-6 py-3 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ingresosFiltrados.map(ingreso => {
                  const res = RESULTADOS[ingreso.resultado] || { texto: ingreso.resultado, clase: 'bg-slate-50 text-slate-600 border-slate-200' };
                  return (
                    <tr key={ingreso.idLog} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 text-slate-600 font-medium">{formatHora(ingreso.fechaHora)}</td>
                      <td className="px-6 py-3 text-slate-800 font-medium">
                        <div className="flex items-center gap-2.5">
                          <FotoSocio idSocio={ingreso.idUsuario} fotoVersion={ingreso.fotoVersion} nombre={ingreso.nombre}
                            className="w-8 h-8 rounded-full" texto="text-[10px]" />
                          <span>{ingreso.nombre}</span>
                          {ingreso.rol !== 'SOCIO' && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-sm">PERSONAL</span>}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-500">{ingreso.dni}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${res.clase}`}>
                          {ingreso.resultado === 'PERMITIDO' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {res.texto}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
