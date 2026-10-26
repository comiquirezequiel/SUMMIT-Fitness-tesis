import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, TrendingUp, CalendarDays, Receipt, Calendar, Search, Plus, Download, RefreshCw, Hourglass, Check, X } from 'lucide-react';
import { apiFetch } from '../services/api';
import { formatFecha, formatHora, formatMoneda, descargarCsv, usuarioActual } from '../utils/formato';
import { textoMetodoPago, ESTADOS_PAGO } from '../utils/constantes';

const TarjetaMonto = ({ title, amount, detalle, icon: Icon, color, onClick, activa }) => (
  <div onClick={onClick}
    className={`bg-white p-5 rounded-xl border shadow-sm flex items-center justify-between transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${activa ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'}`}>
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

// Detalle de un cobro con descuento o matrícula: "Plan $ 20.000 · Familiar − $ 2.000 · Matrícula $ 5.000".
// null si no tiene ninguno de los dos (o es anterior al detalle)
const detalleCobro = (p) => {
  if (p.precioLista == null || (!p.descuentoNombre && p.matriculaMonto == null)) return null;
  const partes = [`Plan ${formatMoneda(p.precioLista)}`];
  if (p.descuentoNombre) partes.push(`${p.descuentoNombre} − ${formatMoneda(p.descuentoMonto)}`);
  if (p.matriculaMonto != null) partes.push(Number(p.matriculaMonto) > 0 ? `Matrícula ${formatMoneda(p.matriculaMonto)}` : 'Matrícula bonificada');
  return partes.join(' · ');
};

/**
 * Caja: ingresos de hoy y del mes, y los cobros registrados (presenciales y débitos automáticos).
 * Solo los pagos aprobados suman. Los "a verificar" se listan aparte y el admin los confirma o rechaza.
 */
const Caja = () => {
  const navigate = useNavigate();
  const esAdmin = usuarioActual()?.rol === 'ADMIN';
  const [resumen, setResumen] = useState(null);
  const [pagina, setPagina] = useState(null); // respuesta paginada de Spring
  const [numeroPagina, setNumeroPagina] = useState(0);
  const [soloAVerificar, setSoloAVerificar] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);
  const [verificando, setVerificando] = useState(null); // id del pago que se está confirmando

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtro = soloAVerificar ? '&estado=PENDIENTE' : '';
      const [resResumen, resPagos] = await Promise.all([
        apiFetch('/pagos/resumen'),
        apiFetch(`/pagos?page=${numeroPagina}&size=${TAMANIO_PAGINA}&sort=fechaPago,desc${filtro}`),
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
  }, [numeroPagina, soloAVerificar]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarFiltro = (valor) => {
    setSoloAVerificar(valor);
    setNumeroPagina(0);
  };

  const verificar = async (pago, aprobado) => {
    if (!aprobado && !window.confirm(`¿Rechazar el pago de ${pago.nombreSocio} por ${formatMoneda(pago.monto)}? No se extenderá su membresía.`)) {
      return;
    }
    setVerificando(pago.idPago);
    try {
      const res = await apiFetch(`/pagos/${pago.idPago}/verificar`, { method: 'POST', body: JSON.stringify({ aprobado }) });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.error || 'No se pudo verificar el pago');
      setAviso(aprobado
        ? `Pago de ${pago.nombreSocio} aprobado: la membresía quedó extendida.`
        : `Pago de ${pago.nombreSocio} rechazado.`);
      setError('');
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setVerificando(null);
    }
  };

  const pagos = pagina?.content || [];
  const filtro = busqueda.trim().toLowerCase();
  const pagosFiltrados = pagos.filter(p => !filtro ||
    p.nombreSocio.toLowerCase().includes(filtro) || p.dniSocio.includes(filtro) ||
    p.plan.toLowerCase().includes(filtro) || (p.comprobante || '').toLowerCase().includes(filtro));

  const exportar = () => descargarCsv(`caja-${new Date().toISOString().substring(0, 10)}.csv`,
    ['Fecha', 'Hora', 'Socio', 'DNI', 'Plan', 'Método', 'Comprobante', 'Estado', 'Cobró', 'Precio de lista', 'Descuento',
      'Monto descontado', 'Matrícula', 'Monto'],
    pagosFiltrados.map(p => [formatFecha(p.fechaPago), formatHora(p.fechaPago), p.nombreSocio, p.dniSocio, p.plan,
      textoMetodoPago(p.metodoPago), p.comprobante, ESTADOS_PAGO[p.estado]?.texto || p.estado, p.registradoPor || 'Sistema',
      p.precioLista, p.descuentoNombre, p.descuentoMonto, p.matriculaMonto, p.monto]));

  const detalleMetodos = resumen && Object.keys(resumen.ingresosHoyPorMetodo).length > 0
    ? Object.entries(resumen.ingresosHoyPorMetodo).map(([m, total]) => `${textoMetodoPago(m)}: ${formatMoneda(total)}`).join(' · ')
    : 'Sin cobros hoy';

  const pendientes = resumen?.pendientesVerificar || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Caja y Pagos</h1>
          <p className="text-sm text-slate-500">Cobros presenciales y débitos automáticos. Solo suman los pagos aprobados.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <TarjetaMonto title="Ingresos hoy" amount={resumen ? formatMoneda(resumen.ingresosHoy) : '—'}
          detalle={detalleMetodos} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
        <TarjetaMonto title="Cobros hoy" amount={resumen ? resumen.cobrosHoy : '—'}
          icon={Receipt} color="bg-blue-50 text-blue-600" />
        <TarjetaMonto title="Ingresos del mes" amount={resumen ? formatMoneda(resumen.ingresosMes) : '—'}
          detalle={resumen ? `${resumen.cobrosMes} cobros` : ''} icon={CalendarDays} color="bg-violet-50 text-violet-600" />
        <TarjetaMonto title="A verificar" amount={resumen ? pendientes : '—'}
          detalle={resumen ? (pendientes > 0 ? `${formatMoneda(resumen.montoPendienteVerificar)} sin confirmar · tocá para ver` : 'Nada pendiente') : ''}
          icon={Hourglass} color="bg-amber-50 text-amber-600"
          onClick={() => cambiarFiltro(!soloAVerificar)} activa={soloAVerificar} />
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>}
      {aviso && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium">{aviso}</div>}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wallet className="w-5 h-5 text-slate-400" /> Movimientos</h2>
            <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
              <button onClick={() => cambiarFiltro(false)}
                className={`px-3 py-1.5 rounded-md transition-colors ${!soloAVerificar ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Todos</button>
              <button onClick={() => cambiarFiltro(true)}
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${soloAVerificar ? 'bg-white shadow-sm text-amber-700' : 'text-slate-500'}`}>
                A verificar {pendientes > 0 && <span className="bg-amber-500 text-white rounded-full px-1.5 min-w-[1.25rem] text-center">{pendientes}</span>}
              </button>
            </div>
          </div>
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

        {soloAVerificar && !esAdmin && pagos.length > 0 && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
            Estos pagos todavía no extendieron la membresía. Los confirma o rechaza un administrador.
          </div>
        )}

        {pagosFiltrados.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            {pagos.length === 0
              ? (soloAVerificar ? 'No hay pagos pendientes de verificar.' : 'Todavía no hay cobros registrados.')
              : 'Ningún cobro coincide con la búsqueda en esta página.'}
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
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagosFiltrados.map((p) => {
                  const estado = ESTADOS_PAGO[p.estado] || ESTADOS_PAGO.APROBADO;
                  return (
                    <tr key={p.idPago} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-700">{formatFecha(p.fechaPago)}</div>
                        <div className="text-slate-400 text-xs flex items-center gap-1 mt-0.5"><Calendar className="w-3 h-3" /> {formatHora(p.fechaPago)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{p.plan}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{p.nombreSocio} · DNI {p.dniSocio}</div>
                        {detalleCobro(p) && <div className="text-[11px] text-slate-400 mt-1">{detalleCobro(p)}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200 whitespace-nowrap">
                          {textoMetodoPago(p.metodoPago)}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-1 whitespace-nowrap">{p.registradoPor ? `Cobró: ${p.registradoPor}` : 'Automático'}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{p.comprobante || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${estado.clase}`}>{estado.texto}</span>
                        {p.verificadoPor && (
                          <div className="text-[11px] text-slate-400 mt-1 whitespace-nowrap">por {p.verificadoPor}</div>
                        )}
                        {p.estado === 'PENDIENTE' && esAdmin && (
                          <div className="flex gap-1.5 mt-2">
                            <button onClick={() => verificar(p, true)} disabled={verificando === p.idPago}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold disabled:opacity-50">
                              <Check className="w-3 h-3" /> Aprobar
                            </button>
                            <button onClick={() => verificar(p, false)} disabled={verificando === p.idPago}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-semibold disabled:opacity-50">
                              <X className="w-3 h-3" /> Rechazar
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {p.estado === 'APROBADO' && <span className="font-bold text-emerald-600">+{formatMoneda(p.monto)}</span>}
                        {p.estado === 'PENDIENTE' && <span className="font-bold text-amber-600">{formatMoneda(p.monto)}</span>}
                        {p.estado === 'RECHAZADO' && <span className="font-medium text-slate-400 line-through">{formatMoneda(p.monto)}</span>}
                      </td>
                    </tr>
                  );
                })}
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
