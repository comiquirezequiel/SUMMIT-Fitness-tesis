import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, CheckCircle, AlertTriangle, UserPlus, 
  Search, Filter, ChevronDown, Download, RefreshCw, Layers,
  ArrowUp, ArrowDown, Eye, Link2, Edit2, MoreVertical, ChevronLeft, ChevronRight, Activity, Wallet, X
} from 'lucide-react';
import StatCard from '../components/StatCard';
import { apiFetch } from '../services/api';

const Socios = () => {
  const navigate = useNavigate();
  const [isStatusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [socios, setSocios] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal de Pagos
  const [isPagoModalOpen, setPagoModalOpen] = useState(false);
  const [selectedSocio, setSelectedSocio] = useState(null);
  const [pagoData, setPagoData] = useState({ idPlan: '', monto: '', metodoPago: 'EFECTIVO', comprobante: '' });
  const [procesandoPago, setProcesandoPago] = useState(false);

  const fetchSocios = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/socios');
      if (!response.ok) throw new Error('Error al obtener los socios');
      const data = await response.json();
      setSocios(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanes = async () => {
    try {
      const response = await apiFetch('/planes');
      if (response.ok) {
        const data = await response.json();
        setPlanes(data);
      }
    } catch (err) {
      console.error('Error fetching planes', err);
    }
  };

  useEffect(() => {
    fetchSocios();
    fetchPlanes();
  }, []);

  const openPagoModal = (socio) => {
    setSelectedSocio(socio);
    setPagoData({ idPlan: '', monto: '', metodoPago: 'EFECTIVO', comprobante: '' });
    setPagoModalOpen(true);
  };

  const handlePlanSelect = (e) => {
    const planId = e.target.value;
    const selectedPlan = planes.find(p => p.idPlan.toString() === planId);
    setPagoData({ ...pagoData, idPlan: planId, monto: selectedPlan ? selectedPlan.precioBase : '' });
  };

  const handleRegistrarPago = async (e) => {
    e.preventDefault();
    setProcesandoPago(true);
    try {
      const response = await apiFetch('/pagos', {
        method: 'POST',
        body: JSON.stringify({
          idUsuario: selectedSocio.idSocio,
          idPlan: pagoData.idPlan,
          monto: pagoData.monto,
          metodoPago: pagoData.metodoPago,
          comprobante: pagoData.comprobante
        })
      });
      
      if (!response.ok) throw new Error('Error al registrar pago');
      
      setPagoModalOpen(false);
      fetchSocios(); // Refrescar para ver la membresía extendida
    } catch (err) {
      alert(err.message);
    } finally {
      setProcesandoPago(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Socios</h1>
          <p className="text-sm text-slate-500">Gestiona los socios de tu gimnasio</p>
        </div>
        <button onClick={() => navigate('/socios/nuevo')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
          <UserPlus className="w-4 h-4" /> Nuevo Socio
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total" value={socios.length.toString()} icon="users" iconColor="text-blue-500" iconBg="bg-blue-50" />
        <StatCard title="Activos" value={socios.filter(s => s.estado === 'ACTIVO').length.toString()} icon="check-circle" iconColor="text-emerald-500" iconBg="bg-emerald-50" />
        <StatCard title="Al Día" value={socios.filter(s => s.membresiaAlDia).length.toString()} icon="layers" iconColor="text-blue-500" iconBg="bg-blue-50" />
        <StatCard title="Apto Vencido" value={socios.filter(s => !s.aptoMedicoVigente).length.toString()} icon="alert-triangle" iconColor="text-amber-500" iconBg="bg-amber-50" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar por nombre, email, teléfono..." 
              className="w-full pl-9 pr-4 py-2 border-0 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto pb-1 md:pb-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            
            <div className="relative shrink-0">
              <button 
                onClick={() => setStatusDropdownOpen(!isStatusDropdownOpen)}
                className="border border-blue-500 rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition-colors bg-white ring-2 ring-blue-100"
              >
                Todos los estados ({socios.length})
                <ChevronDown className="w-4 h-4 text-slate-700 font-bold" />
              </button>
              {isStatusDropdownOpen && (
                <div className="absolute top-full mt-1 left-0 w-56 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-20">
                  <div className="bg-blue-600 text-white cursor-pointer px-4 py-2 text-sm font-medium">
                    Todos los estados ({socios.length})
                  </div>
                  <div className="hover:bg-blue-50 cursor-pointer px-4 py-2 text-sm text-slate-700 border-t border-slate-100">Activo</div>
                  <div className="hover:bg-blue-50 cursor-pointer px-4 py-2 text-sm text-slate-700 border-t border-slate-100">Inactivo</div>
                  <div className="hover:bg-blue-50 cursor-pointer px-4 py-2 text-sm text-slate-700 border-t border-slate-100">Cancelado</div>
                </div>
              )}
            </div>
            
            <div className="h-6 w-px bg-slate-200 mx-1 shrink-0"></div>
            
            <button className="border border-slate-200 rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition-colors shrink-0 bg-white ml-auto md:ml-0">
              <Download className="w-4 h-4 text-slate-500" /> Exportar
            </button>
            
            <button onClick={fetchSocios} className="border border-slate-200 rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors shrink-0 bg-white">
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
        ) : loading ? (
          <div className="p-8 text-center text-slate-500">Cargando socios...</div>
        ) : socios.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No hay socios registrados.</div>
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
                {socios.map(socio => (
                  <tr key={socio.idSocio} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs overflow-hidden border border-blue-200 shrink-0">
                          {socio.nombreCompleto.substring(0, 2).toUpperCase()}
                        </div>
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
                        <span className="font-semibold text-slate-700">{socio.planActual}</span>
                        {socio.membresiaAlDia ? (
                          <span className="inline-flex w-max items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            AL DÍA {socio.vencimientoMembresia && `(Vence ${socio.vencimientoMembresia})`}
                          </span>
                        ) : (
                          <span className="inline-flex w-max items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            VENCIDA {socio.vencimientoMembresia && `(${socio.vencimientoMembresia})`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center gap-2">
                        {socio.estado === 'ACTIVO' ? (
                          <span className="inline-flex w-24 justify-center items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex w-24 justify-center items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {socio.estado}
                          </span>
                        )}
                        {socio.aptoMedicoVigente ? (
                          <span className="inline-flex w-24 justify-center items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-emerald-600">
                            <Activity className="w-3 h-3" /> Apto OK
                          </span>
                        ) : (
                          <span className="inline-flex w-24 justify-center items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100">
                            <Activity className="w-3 h-3" /> Sin Apto
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openPagoModal(socio)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border border-blue-200"
                        >
                          <Wallet className="w-3 h-3" /> Cobrar
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"><Eye className="w-4 h-4" /></button>
                        <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Cobrar */}
      {isPagoModalOpen && selectedSocio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Registrar Pago Manual</h3>
              <button onClick={() => setPagoModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleRegistrarPago} className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mb-2">
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Socio</p>
                <p className="font-semibold text-slate-800">{selectedSocio.nombreCompleto}</p>
                <p className="text-xs text-slate-500">{selectedSocio.dni}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Plan / Membresía</label>
                <select 
                  required
                  value={pagoData.idPlan}
                  onChange={handlePlanSelect}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Seleccione un plan...</option>
                  {planes.map(p => (
                    <option key={p.idPlan} value={p.idPlan}>{p.nombrePlan} (${p.precioBase})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Monto ($)</label>
                  <input 
                    type="number" 
                    required
                    value={pagoData.monto}
                    onChange={e => setPagoData({...pagoData, monto: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Método</label>
                  <select 
                    required
                    value={pagoData.metodoPago}
                    onChange={e => setPagoData({...pagoData, metodoPago: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="MERCADO_PAGO">MercadoPago</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nro Comprobante (Opcional)</label>
                <input 
                  type="text" 
                  value={pagoData.comprobante}
                  onChange={e => setPagoData({...pagoData, comprobante: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setPagoModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={procesandoPago || !pagoData.idPlan}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Wallet className="w-4 h-4" />
                  {procesandoPago ? 'Procesando...' : 'Confirmar Cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Socios;
