import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, TrendingUp, CalendarDays, Receipt, Calendar, Search, Plus, Download, RefreshCw } from 'lucide-react';
import { apiFetch } from '../services/api';
import { formatFecha, formatHora, formatMoneda, descargarCsv } from '../utils/formato';
import { textoMetodoPago } from '../utils/constantes';

const TarjetaMonto = ({ title, amount, detalle, icon: Icon, color }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{amount}</h3>
      {detalle && <p className="text-xs text-slate-500 mt-1">{detalle}</p>}
    </div>
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
      <Icon className="w-6 h-6" />
    </div>
  </div>
);

const TAMANIO_PAGINA = 15;

/**
 * Caja: ingresos de hoy y del mes, y los cobros registrados (en recepción o por la app).
 */
const Caja = () => {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [pagina, setPagina] = useState(null); // respuesta paginada de Spring
  const [numeroPagina, setNumeroPagina] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [resResumen, resPagos] = await Promise.all([
        apiFetch('/pagos/resumen'),
        apiFetch(`/pagos?page=${numeroPagina}&size=${TAMANIO_PAGINA}&sort=fechaPago,desc`),
      ]);
      if (!resResumen.ok || !resPagos.ok) throw new Error();
      setResumen(await resResumen.json());
      setPagina(await resPagos.json());
      setError('');
    } catch {
      setError('No se pudieron cargar los movimientos de caja.');
    } finally {
      setCargando(false);
    }
  }, [numeroPagina]);

  useEffect(() => { cargar(); }, [cargar]);

  const pagos = pagina?.content || [];
  const filtro = busqueda.trim().toLowerCase();
  const pagosFiltrados = pagos.filter(p => !filtro ||
    p.nombreSocio.toLowerCase().includes(filtro) || p.dniSocio.includes(filtro) ||
    p.plan.toLowerCase().includes(filtro) || (p.comprobante || '').toLowerCase().includes(filtro));

  const exportar = () => descargarCsv(`caja-${new Date().toISOString().substring(0, 10)}.csv`,
    ['Fecha', 'Hora', 'Socio', 'DNI', 'Plan', 'Método', 'Comprobante', 'Monto'],
    pagosFiltrados.map(p => [formatFecha(p.fechaPago), formatHora(p.fechaPago), p.nombreSocio, p.dniSocio, p.plan,
      textoMetodoPago(p.metodoPago), p.comprobante, p.monto]));

  const detalleMetodos = resumen && Object.keys(resumen.ingresosHoyPorMetodo).length > 0
    ? Object.entries(resumen.ingresosHoyPorMetodo).map(([m, total]) => `${textoMetodoPago(m)}: ${formatMoneda(total)}`).join(' · ')
    : 'Sin cobros hoy';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Caja y Pagos</h1>
          <p className="text-sm text-slate-500">Ingresos por cobro de membresías</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportar} disabled={pagosFiltrados.length === 0}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button onClick={() => navigate('/socios')} title="El cobro se registra desde la lista de socios"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Registrar cobro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TarjetaMonto title="Ingresos hoy" amount={resumen ? formatMoneda(resumen.ingresosHoy) : '—'}
          detalle={detalleMetodos} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
        <TarjetaMonto title="Cobros hoy" amount={resumen ? resumen.cobrosHoy : '—'}
          icon={Receipt} color="bg-blue-50 text-blue-600" />
        <TarjetaMonto title="Ingresos del mes" amount={resumen ? formatMoneda(resumen.ingresosMes) : '—'}
          detalle={resumen ? `${resumen.cobrosMes} cobros` : ''} icon={CalendarDays} color="bg-violet-50 text-violet-600" />
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wallet className="w-5 h-5 text-slate-400" /> Últimos movimientos</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por socio, DNI, plan..."
                className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-shadow"
              />
            </div>
            <button onClick={cargar} title="Actualizar" className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {pagosFiltrados.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            {pagos.length === 0 ? 'Todavía no hay cobros registrados.' : 'Ningún cobro coincide con la búsqueda en esta página.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Fecha y Hora</th>
                  <th className="px-6 py-4">Concepto / Socio</th>
                  <th className="px-6 py-4">Método</th>
                  <th className="px-6 py-4">Comprobante</th>
                  <th className="px-6 py-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagosFiltrados.map((p) => (
                  <tr key={p.idPago} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-700">{formatFecha(p.fechaPago)}</div>
                      <div className="text-slate-400 text-xs flex items-center gap-1 mt-0.5"><Calendar className="w-3 h-3" /> {formatHora(p.fechaPago)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{p.plan}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{p.nombreSocio} · DNI {p.dniSocio}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200 whitespace-nowrap">
                        {textoMetodoPago(p.metodoPago)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{p.comprobante || '—'}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span className="font-bold text-emerald-600">+{formatMoneda(p.monto)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagina && pagina.totalElements > 0 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-sm text-slate-500">
            <span>Página {pagina.number + 1} de {pagina.totalPages} · {pagina.totalElements} cobros</span>
            <div className="flex gap-1">
              <button onClick={() => setNumeroPagina(n => n - 1)} disabled={pagina.first}
                className="px-3 py-1 border border-slate-200 rounded hover:bg-white transition-colors disabled:opacity-50">Anterior</button>
              <button onClick={() => setNumeroPagina(n => n + 1)} disabled={pagina.last}
                className="px-3 py-1 border border-slate-200 rounded hover:bg-white transition-colors disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Caja;
