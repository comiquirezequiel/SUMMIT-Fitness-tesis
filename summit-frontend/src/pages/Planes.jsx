import React, { useState, useEffect } from 'react';
import { CreditCard, Tag, CalendarDays, Users, Plus, Search, Edit, Filter, Download, RefreshCw, Power, Save } from 'lucide-react';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../components/Campo';
import { apiFetch } from '../services/api';
import { formatMoneda, descargarCsv, usuarioActual } from '../utils/formato';

const textoFrecuencia = (veces) => (veces ? `${veces} ${veces === 1 ? 'vez' : 'veces'} por semana` : 'Pase libre');

/**
 * Alta o edición de un plan. vecesPorSemana: '' = pase libre.
 */
const PlanModal = ({ plan, onClose, onGuardado }) => {
  const [datos, setDatos] = useState({
    nombrePlan: plan?.nombrePlan || '',
    descripcion: plan?.descripcion || '',
    precioBase: plan?.precioBase ?? '',
    duracionDias: plan?.duracionDias ?? 30,
    vecesPorSemana: plan?.vecesPorSemana ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const set = (campo, valor) => setDatos(prev => ({ ...prev, [campo]: valor }));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const cuerpo = {
        nombrePlan: datos.nombrePlan.trim(),
        descripcion: datos.descripcion.trim(),
        precioBase: Number(datos.precioBase),
        duracionDias: Number(datos.duracionDias),
        // 0 = pase libre (en la edición, null significaría "no cambiar")
        vecesPorSemana: datos.vecesPorSemana === '' ? 0 : Number(datos.vecesPorSemana),
      };
      const res = plan
        ? await apiFetch(`/planes/${plan.idPlan}`, { method: 'PUT', body: JSON.stringify(cuerpo) })
        : await apiFetch('/planes', { method: 'POST', body: JSON.stringify(cuerpo) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo guardar el plan');
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      titulo={plan ? 'Editar plan' : 'Nuevo plan'}
      onClose={onClose}
      pie={<>
        <button type="button" onClick={onClose} className={botonSecundario}>Cancelar</button>
        <button type="submit" form="form-plan" disabled={guardando} className={botonPrimario}>
          <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </>}
    >
      <form id="form-plan" onSubmit={guardar} className="grid grid-cols-2 gap-4">
        <Campo label="Nombre del plan" required className="col-span-2">
          <input required maxLength={50} value={datos.nombrePlan} onChange={e => set('nombrePlan', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Descripción" className="col-span-2">
          <input maxLength={255} value={datos.descripcion} onChange={e => set('descripcion', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Precio ($)" required>
          <input type="number" required min="0" step="0.01" value={datos.precioBase} onChange={e => set('precioBase', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Duración (días)" required ayuda="Cuánto extiende la membresía cada cobro">
          <input type="number" required min="1" value={datos.duracionDias} onChange={e => set('duracionDias', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Frecuencia de acceso" className="col-span-2" ayuda="El control de acceso de recepción aplica este límite (lunes a domingo)">
          <select value={datos.vecesPorSemana} onChange={e => set('vecesPorSemana', e.target.value)} className={inputClass}>
            <option value="">Pase libre (todos los días)</option>
            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{textoFrecuencia(n)}</option>)}
          </select>
        </Campo>
        {error && <p className="col-span-2 text-sm text-rose-600 font-medium">{error}</p>}
      </form>
    </Modal>
  );
};

const Planes = () => {
  const esAdmin = usuarioActual()?.rol === 'ADMIN';
  const [planes, setPlanes] = useState([]);
  const [socios, setSocios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState('TODOS');
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState(null); // { plan } (plan null = nuevo)

  const cargar = async () => {
    setCargando(true);
    try {
      const [resPlanes, resSocios] = await Promise.all([apiFetch('/planes'), apiFetch('/socios')]);
      if (!resPlanes.ok) throw new Error('No se pudieron cargar los planes');
      setPlanes(await resPlanes.json());
      setSocios(resSocios.ok ? await resSocios.json() : []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const membresiasAlDia = (plan) => socios.filter(s => s.planActual === plan.nombrePlan && s.membresiaAlDia).length;

  const cambiarEstado = async (plan) => {
    const accion = plan.activo ? 'desactivar' : 'reactivar';
    if (!window.confirm(`¿Seguro que querés ${accion} el plan "${plan.nombrePlan}"?`)) return;
    const res = plan.activo
      ? await apiFetch(`/planes/${plan.idPlan}`, { method: 'DELETE' })
      : await apiFetch(`/planes/${plan.idPlan}`, { method: 'PUT', body: JSON.stringify({ activo: true }) });
    if (!res.ok) setError(`No se pudo ${accion} el plan`);
    cargar();
  };

  const filtro = search.trim().toLowerCase();
  const planesFiltrados = planes
    .filter(p => showInactive || p.activo)
    .filter(p => tipo === 'TODOS' || (tipo === 'LIBRE' ? !p.vecesPorSemana : !!p.vecesPorSemana))
    .filter(p => !filtro || p.nombrePlan.toLowerCase().includes(filtro) || (p.descripcion || '').toLowerCase().includes(filtro))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombrePlan.localeCompare(b.nombrePlan));

  const exportar = () => descargarCsv('planes.csv',
    ['Plan', 'Descripción', 'Precio', 'Duración (días)', 'Frecuencia', 'Activo', 'Membresías al día'],
    planesFiltrados.map(p => [p.nombrePlan, p.descripcion, p.precioBase, p.duracionDias, textoFrecuencia(p.vecesPorSemana), p.activo ? 'Sí' : 'No', membresiasAlDia(p)]));

  const activos = planes.filter(p => p.activo);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Planes</h1>
          <p className="text-sm text-slate-500 mt-1">Gestión de planes y membresías</p>
        </div>
        {esAdmin && (
          <button onClick={() => setModal({ plan: null })} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap">
            <Plus className="w-4 h-4" /> Nuevo plan
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total planes" value={planes.length.toString()} icon={CreditCard} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Planes activos" value={activos.length.toString()} icon={Tag} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Con límite semanal" value={activos.filter(p => p.vecesPorSemana).length.toString()} icon={CalendarDays} iconColor="text-purple-600" iconBg="bg-purple-50" />
        <StatCard title="Membresías al día" value={socios.filter(s => s.membresiaAlDia).length.toString()} icon={Users} iconColor="text-rose-600" iconBg="bg-rose-50" />
      </div>

      {/* Barra de búsqueda */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
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
          <select value={tipo} onChange={e => setTipo(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 bg-white">
            <option value="TODOS">Todos los tipos</option>
            <option value="LIBRE">Pase libre</option>
            <option value="LIMITE">Con límite semanal</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Mostrar inactivos
          </label>
          <button onClick={exportar} className="border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 flex items-center gap-2 hover:bg-slate-50 ml-auto">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button onClick={cargar} title="Actualizar" className="border border-slate-200 rounded-lg p-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700">
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>}

      {/* Grid de Planes */}
      {!cargando && planesFiltrados.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">No hay planes para mostrar.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {planesFiltrados.map(plan => (
            <div key={plan.idPlan} className={`bg-white border rounded-xl p-5 shadow-sm transition-colors ${plan.activo ? 'border-slate-200 hover:border-blue-300' : 'border-dashed border-slate-300 opacity-70'}`}>
              <div className="flex items-start justify-between mb-3 gap-2">
                <h3 className="font-bold text-slate-800">{plan.nombrePlan}</h3>
                {!plan.activo && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">INACTIVO</span>}
              </div>

              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border mb-3 ${plan.vecesPorSemana ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                <CalendarDays className="w-3 h-3" /> {textoFrecuencia(plan.vecesPorSemana)}
              </span>

              <div className="mb-2">
                <span className="text-2xl font-bold text-slate-800">{formatMoneda(plan.precioBase)}</span>
                <span className="text-sm text-slate-400 ml-1">/ {plan.duracionDias} días</span>
              </div>
              {plan.descripcion && <p className="text-xs text-slate-500 mb-3">{plan.descripcion}</p>}

              <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
                <span>Membresías al día</span>
                <span className="font-bold">{membresiasAlDia(plan)}</span>
              </div>

              {esAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => setModal({ plan })} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <Edit className="w-4 h-4" /> Editar plan
                  </button>
                  <button onClick={() => cambiarEstado(plan)} title={plan.activo ? 'Desactivar' : 'Reactivar'}
                    className={`px-3 border rounded-lg transition-colors ${plan.activo ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                    <Power className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && <PlanModal plan={modal.plan} onClose={() => setModal(null)} onGuardado={() => { setModal(null); cargar(); }} />}
    </div>
  );
};

export default Planes;
