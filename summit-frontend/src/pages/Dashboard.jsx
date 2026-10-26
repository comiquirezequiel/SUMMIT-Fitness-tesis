import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, UserPlus, UserX, AlertTriangle, Calendar,
  DollarSign, CalendarCheck, Activity, Search, Clock, CheckCircle, XCircle, Smartphone, ShieldCheck
} from 'lucide-react';
import StatCard from '../components/StatCard';
import ControlAcceso from '../components/ControlAcceso';
import { FaltasIngreso, AvisosIngreso, DatosFicha } from '../components/FichaIngreso';
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
  DENEGADO_FUERA_DE_RANGO_GPS: { texto: 'Fuera de rango', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const ACTUALIZAR_CADA_MS = 30000;
// Cada 5 s se pregunta solo por los ingresos nuevos: el que entra con la app aparece enseguida con su foto
const NUEVOS_CADA_MS = 5000;
const RECIENTES_MS = 3 * 60 * 1000; // cuánto tiempo se destaca un ingreso con la app

const haceCuanto = (fechaHora, ahora) => {
  const segundos = Math.max(0, Math.round((ahora - new Date(fechaHora).getTime()) / 1000));
  return segundos < 60 ? `hace ${segundos} s` : `hace ${Math.floor(segundos / 60)} min`;
};

// "350 m" o "1,5 km"
const textoMetros = (metros) => (metros < 1000 ? `${Math.round(metros)} m` : `${(metros / 1000).toFixed(1).replace('.', ',')} km`);

const estiloResultado = (resultado) =>
  RESULTADOS[resultado] || { texto: resultado, clase: 'bg-slate-50 text-slate-600 border-slate-200' };

// El ingreso con la app más reciente, con la ficha completa del momento: la misma que muestra el control por DNI
const IngresoConAppDetalle = ({ ingreso, ahora }) => {
  const { ficha } = ingreso;
  const permitido = ingreso.resultado === 'PERMITIDO';
  const fueraDeRango = ingreso.resultado === 'DENEGADO_FUERA_DE_RANGO_GPS';
  const res = estiloResultado(ingreso.resultado);
  return (
    <div className={`p-4 md:p-5 ${permitido ? 'bg-emerald-50/60' : 'bg-rose-50/60'}`}>
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <FotoSocio idSocio={ingreso.idUsuario} fotoVersion={ingreso.fotoVersion} nombre={ingreso.nombre}
            className="w-24 h-24 md:w-28 md:h-28 rounded-2xl" texto="text-2xl" />
          <span className={`absolute -bottom-2 -right-2 w-9 h-9 rounded-full ring-4 ring-white flex items-center justify-center ${permitido ? 'bg-emerald-500' : 'bg-rose-500'}`}>
            {permitido ? <ShieldCheck className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-black uppercase tracking-widest ${permitido ? 'text-emerald-600' : 'text-rose-600'}`}>
            {permitido ? 'Acceso permitido' : 'Acceso denegado'}
          </p>
          <h3 className="text-2xl md:text-3xl font-extrabold text-slate-800 leading-tight truncate">{ingreso.nombre}</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            DNI {ingreso.dni}{ficha ? ` · ${ficha.plan || 'Sin plan'}` : ''} · {haceCuanto(ingreso.fechaHora, ahora)}
          </p>
          {!ingreso.fotoVersion && <p className="text-xs text-amber-700 mt-1">Sin foto: sacala desde su ficha</p>}
        </div>
      </div>
      {fueraDeRango && (
        <p className="mt-4 flex items-start gap-2 bg-rose-100 text-rose-800 rounded-lg px-3 py-2 text-sm font-semibold">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {ingreso.distanciaMetros != null
            ? `Estaba a ${textoMetros(ingreso.distanciaMetros)} del gimnasio: la app no lo dejó entrar`
            : 'Estaba fuera del radio del gimnasio: la app no lo dejó entrar'}
        </p>
      )}
      {ficha ? (
        <>
          <FaltasIngreso faltas={ficha.faltas} />
          <AvisosIngreso avisos={ficha.avisos} />
          <DatosFicha ficha={ficha} />
        </>
      ) : !fueraDeRango && (
        // Sin la ficha del momento (por ejemplo, si el servidor se reinició): queda el resultado
        <span className={`mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${res.clase}`}>
          {permitido ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {res.texto}
        </span>
      )}
    </div>
  );
};

// Quién acaba de entrar con el QR de la app: recepción no lo atendió, así que se muestra con la foto grande para
// comparar con la persona que pasa. El último, con la ficha completa; los anteriores, resumidos.
const IngresosConApp = ({ ingresos, ahora, onOcultar }) => {
  const [ultimo, ...anteriores] = ingresos;
  return (
    <div className="bg-white border border-violet-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-violet-100 bg-violet-50/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-violet-800 flex items-center gap-2">
          <Smartphone className="w-4 h-4" /> Recién entraron con la app
        </h3>
        <button onClick={onOcultar} className="text-xs font-semibold text-violet-600 hover:text-violet-800">Ocultar</button>
      </div>
      <IngresoConAppDetalle ingreso={ultimo} ahora={ahora} />
      {anteriores.length > 0 && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-violet-100">
          {anteriores.map(ingreso => {
            const permitido = ingreso.resultado === 'PERMITIDO';
            const res = estiloResultado(ingreso.resultado);
            return (
              <div key={ingreso.idLog} className={`flex items-center gap-4 rounded-xl border p-3 ${permitido ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/60'}`}>
                <FotoSocio idSocio={ingreso.idUsuario} fotoVersion={ingreso.fotoVersion} nombre={ingreso.nombre}
                  className="w-16 h-16 rounded-2xl" texto="text-lg" />
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{ingreso.nombre}</p>
                  <p className="text-xs text-slate-500">DNI {ingreso.dni} · {haceCuanto(ingreso.fechaHora, ahora)}</p>
                  <span className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${res.clase}`}>
                    {permitido ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {res.texto}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const usuario = usuarioActual();
  const [resumen, setResumen] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cobroRapido, setCobroRapido] = useState(false);
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(() => Date.now());
  const [ocultosHasta, setOcultosHasta] = useState(0); // "Ocultar" en los ingresos con la app: hasta qué idLog
  const ultimoId = useRef(null); // el ingreso más nuevo que ya se tiene (null: todavía no se cargó la lista)

  const cargarDatos = useCallback(async () => {
    try {
      const [resResumen, resIngresos] = await Promise.all([
        apiFetch('/dashboard/resumen'),
        apiFetch('/dashboard/ingresos-hoy'),
      ]);
      if (!resResumen.ok || !resIngresos.ok) throw new Error();
      setResumen(await resResumen.json());
      const lista = await resIngresos.json();
      setIngresos(lista);
      ultimoId.current = lista.reduce((max, i) => Math.max(max, i.idLog), ultimoId.current ?? 0);
      setError('');
    } catch {
      setError('No se pudieron cargar los datos del tablero.');
    }
  }, []);

  // Solo los posteriores al último que se tiene (casi siempre ninguno), y con la pestaña a la vista
  const buscarNuevos = useCallback(async () => {
    setAhora(Date.now());
    if (ultimoId.current === null || document.hidden) return;
    try {
      const res = await apiFetch(`/dashboard/ingresos-hoy?despuesDe=${ultimoId.current}`);
      if (!res.ok) return;
      const nuevos = await res.json();
      if (nuevos.length === 0) return;
      ultimoId.current = nuevos.reduce((max, i) => Math.max(max, i.idLog), ultimoId.current);
      setIngresos(lista => [...nuevos, ...lista.filter(i => !nuevos.some(n => n.idLog === i.idLog))]);
      const resResumen = await apiFetch('/dashboard/resumen');
      if (resResumen.ok) setResumen(await resResumen.json());
    } catch {
      // sin conexión: la recarga completa de cada 30 s muestra el aviso
    }
  }, []);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, ACTUALIZAR_CADA_MS);
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  useEffect(() => {
    const intervalo = setInterval(buscarNuevos, NUEVOS_CADA_MS);
    return () => clearInterval(intervalo);
  }, [buscarNuevos]);

  // La lista viene del más nuevo al más viejo
  const recientesConApp = ingresos
    .filter(i => i.tipoEvento === 'CHECKIN_QR' && i.idLog > ocultosHasta && ahora - new Date(i.fechaHora).getTime() < RECIENTES_MS)
    .slice(0, 3);

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
            <span className="bg-blue-200 text-blue-800 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ml-1">{usuario.rol}</span>
          )}
        </div>
      </div>

      <ControlAcceso onIngreso={cargarDatos} />
      {cobroRapido && (
        <CobroRapido onClose={() => setCobroRapido(false)} onCobrado={() => { setCobroRapido(false); cargarDatos(); }} />
      )}

      {recientesConApp.length > 0 && (
        <IngresosConApp ingresos={recientesConApp} ahora={ahora} onOcultar={() => setOcultosHasta(recientesConApp[0].idLog)} />
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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden min-h-[300px] flex flex-col shadow-sm">
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
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 w-full sm:w-[300px] transition-shadow"
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
                          {ingreso.rol !== 'SOCIO' && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">PERSONAL</span>}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-500">{ingreso.dni}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${res.clase}`}>
                          {ingreso.resultado === 'PERMITIDO' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {res.texto}
                        </span>
                        {ingreso.tipoEvento === 'CHECKIN_QR' && (
                          <span title="Ingresó escaneando el QR de recepción desde la app" className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded">
                            <Smartphone className="w-3 h-3" />APP
                          </span>
                        )}
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
