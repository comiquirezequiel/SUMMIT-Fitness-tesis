import { useState, useEffect } from 'react';
import { AlertTriangle, CalendarX, Clock, CheckCircle2, UserX, Wallet, Phone, Snowflake } from 'lucide-react';
import CobroModal from '../components/socios/CobroModal';
import { apiFetch } from '../services/api';
import { formatFecha, diasHasta, textoVencimiento, usuarioActual } from '../utils/formato';

// Categoría de cada socio según los días que faltan para que venza su membresía. Los que tienen la membresía
// congelada hoy van aparte (su vencimiento ya incluye los días congelados)
const TABS = [
  { id: 'vencidas', label: 'Vencidas', icon: CalendarX, color: 'rose', incluye: (s) => !s.congeladaHasta && s.dias !== null && s.dias < 0 },
  { id: '0-7', label: '0-7 días', icon: AlertTriangle, color: 'orange', incluye: (s) => !s.congeladaHasta && s.dias !== null && s.dias >= 0 && s.dias <= 7 },
  { id: '8-15', label: '8-15 días', icon: Clock, color: 'yellow', incluye: (s) => !s.congeladaHasta && s.dias !== null && s.dias >= 8 && s.dias <= 15 },
  { id: '15+', label: '15+ días', icon: CheckCircle2, color: 'emerald', incluye: (s) => !s.congeladaHasta && s.dias !== null && s.dias > 15 },
  { id: 'congeladas', label: 'Congeladas', icon: Snowflake, color: 'cyan', incluye: (s) => !!s.congeladaHasta },
  { id: 'sin-plan', label: 'Sin membresía', icon: UserX, color: 'slate', incluye: (s) => !s.congeladaHasta && s.dias === null },
];

const COLORES = {
  rose: { border: 'border-rose-200', text: 'text-rose-600', activeBg: 'bg-rose-50', activeBorder: 'border-rose-500' },
  orange: { border: 'border-orange-200', text: 'text-orange-600', activeBg: 'bg-orange-50', activeBorder: 'border-orange-500' },
  yellow: { border: 'border-yellow-200', text: 'text-yellow-600', activeBg: 'bg-yellow-50', activeBorder: 'border-yellow-500' },
  emerald: { border: 'border-emerald-200', text: 'text-emerald-600', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-500' },
  cyan: { border: 'border-cyan-200', text: 'text-cyan-700', activeBg: 'bg-cyan-50', activeBorder: 'border-cyan-500' },
  slate: { border: 'border-slate-200', text: 'text-slate-600', activeBg: 'bg-slate-50', activeBorder: 'border-slate-500' },
};

const EstadoMembresias = () => {
  const puedeCobrar = ['ADMIN', 'RECEPCION'].includes(usuarioActual()?.rol);
  const [activeTab, setActiveTab] = useState('vencidas');
  const [socios, setSocios] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [error, setError] = useState('');
  const [socioCobro, setSocioCobro] = useState(null);

  const cargar = async () => {
    try {
      const [resSocios, resPlanes] = await Promise.all([apiFetch('/socios'), apiFetch('/planes')]);
      if (!resSocios.ok) throw new Error();
      // Los socios dados de baja no cuentan para el seguimiento de membresías
      setSocios((await resSocios.json()).filter(s => s.estado !== 'CANCELADO'));
      setPlanes(resPlanes.ok ? await resPlanes.json() : []);
      setError('');
    } catch {
      setError('No se pudieron cargar las membresías.');
    }
  };

  useEffect(() => { cargar(); }, []);

  const conDias = socios.map(s => ({ ...s, dias: diasHasta(s.vencimientoMembresia) }));
  const tabActiva = TABS.find(t => t.id === activeTab);
  const lista = conDias.filter(s => tabActiva.incluye(s)).sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));

  const getTabColors = (tab, isActive) => {
    const theme = COLORES[tab.color];
    if (isActive) return `${theme.activeBg} ${theme.activeBorder} ${theme.text} shadow-xs`;
    return `bg-white ${theme.border} text-slate-500 hover:bg-slate-50 opacity-70`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Estado de Membresías</h1>
          <p className="text-sm text-slate-500 mt-1">Gestiona membresías próximas a vencer y vencidas</p>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const cantidad = conDias.filter(s => tab.incluye(s)).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex justify-between items-start p-5 rounded-xl border-2 transition-all text-left ${getTabColors(tab, isActive)} ${isActive ? 'shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] -translate-y-0.5' : 'shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:-translate-y-0.5'}`}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-[13px] mb-2">{tab.label}</span>
                  <span className="text-4xl font-extrabold tracking-tight">{cantidad}</span>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/50">
                  <Icon className="w-5 h-5 opacity-90" />
                </div>
              </button>
            );
          })}
        </div>

        {lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-sm font-medium">No hay membresías en esta categoría</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Socio</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Vencimiento</th>
                  {puedeCobrar && <th className="px-4 py-3 font-medium text-right">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map(s => (
                  <tr key={s.idSocio} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{s.nombreCompleto}</p>
                      <p className="text-xs text-slate-500">DNI {s.dni}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.telefono ? <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" />{s.telefono}</span> : s.email}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{s.planActual}</td>
                    <td className="px-4 py-3">
                      {s.vencimientoMembresia
                        ? <><p className="text-slate-700">{formatFecha(s.vencimientoMembresia)}</p><p className={`text-xs ${s.dias < 0 ? 'text-rose-600' : 'text-slate-500'}`}>{textoVencimiento(s.dias)}</p>
                            {s.congeladaHasta && (
                              <p className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700 text-[11px] font-semibold">
                                <Snowflake className="w-3 h-3" /> Congelada hasta el {formatFecha(s.congeladaHasta)}
                              </p>
                            )}</>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    {puedeCobrar && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setSocioCobro(s)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold inline-flex items-center gap-1 border border-blue-200">
                          <Wallet className="w-3 h-3" /> {s.vencimientoMembresia ? 'Renovar' : 'Cobrar'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {socioCobro && (
        <CobroModal socio={socioCobro} planes={planes} onClose={() => setSocioCobro(null)}
          onGuardado={() => { setSocioCobro(null); cargar(); }} />
      )}
    </div>
  );
};

export default EstadoMembresias;
