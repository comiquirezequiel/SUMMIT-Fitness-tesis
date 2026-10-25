import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users, CheckCircle, AlertTriangle, UserPlus,
  Search, Filter, ChevronDown, Download, RefreshCw, Layers,
  Eye, Edit2, Activity, Wallet, Repeat
} from 'lucide-react';
import StatCard from '../components/StatCard';
import CobroModal from '../components/socios/CobroModal';
import EditarSocioModal from '../components/socios/EditarSocioModal';
import FichaSocioModal from '../components/socios/FichaSocioModal';
import FotoSocio from '../components/socios/FotoSocio';
import { apiFetch } from '../services/api';
import { formatFecha, descargarCsv, usuarioActual } from '../utils/formato';
import { ESTADOS_USUARIO } from '../utils/constantes';

const FILTROS_ESTADO = [
  { valor: 'TODOS', texto: 'Todos los estados' },
  ...Object.entries(ESTADOS_USUARIO).map(([valor, { texto }]) => ({ valor, texto })),
];

const Socios = () => {
  const navigate = useNavigate();
  const puedeEditar = ['ADMIN', 'RECEPCION'].includes(usuarioActual()?.rol);
  const [socios, setSocios] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [parametros] = useSearchParams();
  const [busqueda, setBusqueda] = useState(parametros.get('buscar') || ''); // ?buscar=DNI (desde Débitos automáticos)
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [menuEstadoAbierto, setMenuEstadoAbierto] = useState(false);
  const menuRef = useRef(null);

  // Modal abierto: { tipo: 'cobro' | 'editar' | 'ficha', socio }
  const [modal, setModal] = useState(null);

  const fetchSocios = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/socios');
      if (!response.ok) throw new Error('Error al obtener los socios');
      const data = await response.json();
      setSocios(data.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Socios con débito automático activo (solo admin y recepción pueden consultarlo)
  const [conDebito, setConDebito] = useState(new Set());
  const fetchDebitos = async () => {
    if (!puedeEditar) return;
    try {
      const response = await apiFetch('/debitos?estado=ACTIVO');
      if (response.ok) setConDebito(new Set((await response.json()).map(d => d.idSocio)));
    } catch {
      // Sin la marca de débito la tabla funciona igual
    }
  };

  const fetchPlanes = async () => {
    try {
      const response = await apiFetch('/planes');
      if (response.ok) setPlanes(await response.json());
    } catch (err) {
      console.error('Error fetching planes', err);
    }
  };

  useEffect(() => {
    fetchSocios();
    fetchPlanes();
    fetchDebitos();
  }, []);

  // Cerrar el menú de estados al hacer clic afuera
  useEffect(() => {
    const cerrar = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuEstadoAbierto(false); };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const filtro = busqueda.trim().toLowerCase();
  const sociosFiltrados = socios.filter(s =>
    (filtroEstado === 'TODOS' || s.estado === filtroEstado) &&
    (!filtro ||
      s.nombreCompleto.toLowerCase().includes(filtro) ||
      s.dni.includes(filtro) ||
      s.email.toLowerCase().includes(filtro) ||
      (s.telefono || '').includes(filtro)));

  const exportar = () => {
    descargarCsv(`socios-${new Date().toISOString().substring(0, 10)}.csv`,
      ['DNI', 'Nombre', 'Email', 'Teléfono', 'Estado', 'Plan', 'Vence membresía', 'Membresía al día', 'Apto vigente', 'Vence apto'],
      sociosFiltrados.map(s => [
        s.dni, s.nombreCompleto, s.email, s.telefono, ESTADOS_USUARIO[s.estado]?.texto || s.estado, s.planActual,
        s.vencimientoMembresia ? formatFecha(s.vencimientoMembresia) : '', s.membresiaAlDia ? 'Sí' : 'No',
        s.aptoMedicoVigente ? 'Sí' : 'No', s.vencimientoApto ? formatFecha(s.vencimientoApto) : '',
      ]));
  };

  const cerrarYRefrescar = () => {
    setModal(null);
    fetchSocios();
  };

  const textoFiltro = FILTROS_ESTADO.find(f => f.valor === filtroEstado)?.texto;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-2 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Socios</h1>
          <p className="text-sm text-slate-500">Gestiona los socios de tu gimnasio</p>
        </div>
        {puedeEditar && (
          <button onClick={() => navigate('/socios/nuevo')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap">
            <UserPlus className="w-4 h-4" /> Nuevo Socio
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total" value={socios.length.toString()} icon={Users} iconColor="text-blue-500" iconBg="bg-blue-50" />
        <StatCard title="Activos" value={socios.filter(s => s.estado === 'ACTIVO').length.toString()} icon={CheckCircle} iconColor="text-emerald-500" iconBg="bg-emerald-50" />
        <StatCard title="Al Día" value={socios.filter(s => s.membresiaAlDia).length.toString()} icon={Layers} iconColor="text-blue-500" iconBg="bg-blue-50" />
        <StatCard title="Sin apto vigente" value={socios.filter(s => !s.aptoMedicoVigente).length.toString()} icon={AlertTriangle} iconColor="text-amber-500" iconBg="bg-amber-50" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, DNI, email o teléfono..."
              className="w-full pl-9 pr-4 py-2 border-0 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto pb-1 md:pb-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />

            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuEstadoAbierto(!menuEstadoAbierto)}
                className="border border-blue-500 rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition-colors bg-white ring-2 ring-blue-100"
              >
                {textoFiltro} ({sociosFiltrados.length})
                <ChevronDown className="w-4 h-4 text-slate-700 font-bold" />
              </button>
              {menuEstadoAbierto && (
                <div className="absolute top-full mt-1 left-0 w-56 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-20">
                  {FILTROS_ESTADO.map(f => (
                    <div
                      key={f.valor}
                      onClick={() => { setFiltroEstado(f.valor); setMenuEstadoAbierto(false); }}
                      className={`cursor-pointer px-4 py-2 text-sm border-t border-slate-100 first:border-t-0 ${filtroEstado === f.valor ? 'bg-blue-600 text-white font-medium' : 'text-slate-700 hover:bg-blue-50'}`}
                    >
                      {f.texto} ({f.valor === 'TODOS' ? socios.length : socios.filter(s => s.estado === f.valor).length})
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-slate-200 mx-1 shrink-0"></div>

            <button onClick={exportar} disabled={sociosFiltrados.length === 0}
              className="border border-slate-200 rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50 transition-colors shrink-0 bg-white ml-auto md:ml-0">
              <Download className="w-4 h-4 text-slate-500" /> Exportar
            </button>

            <button onClick={fetchSocios} title="Actualizar" className="border border-slate-200 rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors shrink-0 bg-white">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {error ? (
          <div className="p-8 text-center text-red-500 bg-red-50 font-medium">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            {error}
          </div>
        ) : loading && socios.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Cargando socios...</div>
        ) : sociosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {socios.length === 0 ? 'No hay socios registrados.' : 'Ningún socio coincide con la búsqueda.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Socio</th>
                  <th className="px-6 py-4 font-medium">Contacto</th>
                  <th className="px-6 py-4 font-medium">Membresía</th>
                  <th className="px-6 py-4 font-medium text-center">Estado / Apto</th>
                  <th className="px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sociosFiltrados.map(socio => {
                  const estado = ESTADOS_USUARIO[socio.estado] || { texto: socio.estado, clase: 'bg-slate-100 text-slate-600 border-slate-200' };
                  return (
                    <tr key={socio.idSocio} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <FotoSocio idSocio={socio.idSocio} fotoVersion={socio.fotoVersion} nombre={socio.nombreCompleto} />
                          <div>
                            <div className="font-medium text-slate-800">{socio.nombreCompleto}</div>
                            <div className="text-slate-500 text-xs mt-0.5">DNI: {socio.dni}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-700">{socio.email}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{socio.telefono}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                            {socio.planActual}
                            {conDebito.has(socio.idSocio) && (
                              <span title="Paga con débito automático (Mercado Pago)"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                <Repeat className="w-3 h-3" /> DÉBITO
                              </span>
                            )}
                          </span>
                          {socio.membresiaAlDia && socio.estado !== 'ACTIVO' ? (
                            // Cuota paga pero cuenta de baja, suspendida o inactiva: el control de acceso no lo deja pasar
                            <span className="inline-flex w-max items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              No puede ingresar {socio.vencimientoMembresia && `(Vence ${formatFecha(socio.vencimientoMembresia)})`}
                            </span>
                          ) : socio.membresiaAlDia ? (
                            <span className="inline-flex w-max items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              AL DÍA {socio.vencimientoMembresia && `(Vence ${formatFecha(socio.vencimientoMembresia)})`}
                            </span>
                          ) : (
                            <span className="inline-flex w-max items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              {socio.vencimientoMembresia ? `VENCIDA (${formatFecha(socio.vencimientoMembresia)})` : 'SIN MEMBRESÍA'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-2">
                          <span className={`inline-flex w-24 justify-center items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${estado.clase}`}>
                            {estado.texto}
                          </span>
                          {socio.aptoMedicoVigente ? (
                            <span className="inline-flex justify-center items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-emerald-600" title={socio.vencimientoApto ? `Vence ${formatFecha(socio.vencimientoApto)}` : ''}>
                              <Activity className="w-3 h-3" /> Apto OK
                            </span>
                          ) : (
                            <span className="inline-flex justify-center items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100">
                              <Activity className="w-3 h-3" /> {socio.vencimientoApto ? 'Apto vencido' : 'Sin apto'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {puedeEditar && (
                            <button
                              onClick={() => setModal({ tipo: 'cobro', socio })}
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border border-blue-200"
                            >
                              <Wallet className="w-3 h-3" /> Cobrar
                            </button>
                          )}
                          <button onClick={() => setModal({ tipo: 'ficha', socio })} title="Ver ficha" className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          {puedeEditar && (
                            <button onClick={() => setModal({ tipo: 'editar', socio })} title="Editar" className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.tipo === 'cobro' && (
        <CobroModal socio={modal.socio} planes={planes} onClose={() => setModal(null)} onGuardado={cerrarYRefrescar} />
      )}
      {modal?.tipo === 'editar' && (
        <EditarSocioModal socio={modal.socio} onClose={() => setModal(null)} onGuardado={cerrarYRefrescar} />
      )}
      {modal?.tipo === 'ficha' && (
        <FichaSocioModal socio={modal.socio} puedeEditar={puedeEditar} onActualizado={fetchSocios}
          onClose={() => { setModal(null); fetchDebitos(); }} />
      )}
    </div>
  );
};

export default Socios;
