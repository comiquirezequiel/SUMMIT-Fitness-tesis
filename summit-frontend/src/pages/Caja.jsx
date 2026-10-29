import { useState, useEffect, useCallback } from 'react';
import { Wallet, TrendingUp, TrendingDown, CalendarDays, Calendar, Search, Plus, Download, RefreshCw, Hourglass, Check, X, Lock, Receipt, FileText } from 'lucide-react';
import Modal from '../components/Modal';
import CobroRapido from '../components/socios/CobroRapido';
import ComprobantePago from '../components/socios/ComprobantePago';
import GastoModal from '../components/caja/GastoModal';
import CierreCajaModal from '../components/caja/CierreCajaModal';
import TablaGastos from '../components/caja/TablaGastos';
import TablaCierres from '../components/caja/TablaCierres';
import Paginador from '../components/caja/Paginador';
import { apiFetch } from '../services/api';
import { obtenerTurno } from '../services/caja';
import { facturarCobro, ESTADOS_COMPROBANTE } from '../services/facturacion';
import { useFunciones } from '../services/funciones';
import { formatFecha, formatHora, formatFechaHora, formatMoneda, descargarCsv, usuarioActual } from '../utils/formato';
import { textoMetodoPago, ESTADOS_PAGO } from '../utils/constantes';

const TarjetaMonto = ({ title, amount, detalle, icon: Icon, color, onClick, activa }) => (
  <div onClick={onClick}
    className={`bg-white p-5 rounded-xl border shadow-xs flex items-center justify-between transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${activa ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'}`}>
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

// La factura electrónica de un cobro, en pocas palabras: "Factura C 00002-00000154", "Factura pendiente"...
const textoFactura = (f) => {
  if (f.anulada) return `Factura ${f.letra} ${f.numero} anulada`;
  if (f.estado === 'AUTORIZADO') return `Factura ${f.letra} ${f.numero}`;
  return `Factura ${ESTADOS_COMPROBANTE[f.estado]?.texto.toLowerCase() || f.estado}`;
};
const claseFactura = (f) => (f.anulada ? 'text-slate-400 line-through'
  : f.estado === 'AUTORIZADO' ? 'text-emerald-700' : f.estado === 'RECHAZADO' ? 'text-rose-600' : 'text-amber-700');

const PESTANAS = [
  { id: 'cobros', texto: 'Cobros' },
  { id: 'gastos', texto: 'Gastos' },
  { id: 'cierres', texto: 'Cierres de caja' },
];

/**
 * Caja: ingresos y egresos de hoy y del mes, el turno abierto (con su cierre), los cobros registrados (presenciales y
 * débitos automáticos), los gastos y los cierres de caja anteriores.
 * Solo los pagos aprobados suman. Los "a verificar" se listan aparte y el admin los confirma o rechaza.
 */
const Caja = () => {
  const esAdmin = usuarioActual()?.rol === 'ADMIN';
  const { facturacion } = useFunciones();
  const [pestana, setPestana] = useState('cobros');
  const [modal, setModal] = useState(null); // 'cobro' | 'gasto' | 'cierre'
  const [comprobante, setComprobante] = useState(null); // el cobro cuyo comprobante se está mirando
  const [turno, setTurno] = useState(null);
  const [version, setVersion] = useState(0); // cambiarla recarga las tablas de gastos y cierres
  const [resumen, setResumen] = useState(null);
  const [pagina, setPagina] = useState(null); // respuesta paginada de Spring
  const [numeroPagina, setNumeroPagina] = useState(0);
  const [soloAVerificar, setSoloAVerificar] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);
  const [verificando, setVerificando] = useState(null); // id del pago que se está confirmando o facturando

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtro = soloAVerificar ? '&estado=PENDIENTE' : '';
      const [resResumen, resPagos, turnoActual] = await Promise.all([
        apiFetch('/pagos/resumen'),
        apiFetch(`/pagos?page=${numeroPagina}&size=${TAMANIO_PAGINA}&sort=fechaPago,desc${filtro}`),
        obtenerTurno(),
      ]);
      if (!resResumen.ok || !resPagos.ok) throw new Error();
      setResumen(await resResumen.json());
      setPagina(await resPagos.json());
      setTurno(turnoActual);
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

  // Un cobro sin factura (por ejemplo, de antes de prender la facturación): el admin la pide a mano
  const facturar = async (pago) => {
    setVerificando(pago.idPago);
    try {
      await facturarCobro(pago.idPago, false);
      setAviso(`Se pidió la factura del cobro de ${pago.nombreSocio}: sale en unos segundos.`);
      setError('');
      setTimeout(cargar, 2000);
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
      'Monto descontado', 'Matrícula', 'Monto', ...(facturacion ? ['Factura'] : [])],
    pagosFiltrados.map(p => [formatFecha(p.fechaPago), formatHora(p.fechaPago), p.nombreSocio, p.dniSocio, p.plan,
      textoMetodoPago(p.metodoPago), p.comprobante, ESTADOS_PAGO[p.estado]?.texto || p.estado, p.registradoPor || 'Sistema',
      p.precioLista, p.descuentoNombre, p.descuentoMonto, p.matriculaMonto, p.monto,
      ...(facturacion ? [p.factura ? textoFactura(p.factura) : ''] : [])]));

  const detalleMetodos = resumen && Object.keys(resumen.ingresosHoyPorMetodo).length > 0
    ? Object.entries(resumen.ingresosHoyPorMetodo).map(([m, total]) => `${textoMetodoPago(m)}: ${formatMoneda(total)}`).join(' · ')
    : 'Sin cobros hoy';

  const pendientes = resumen?.pendientesVerificar || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Caja y Pagos</h1>
          <p className="text-sm text-slate-500">Cobros, gastos y cierres de caja. Solo suman los pagos aprobados.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setModal('gasto')}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-xs">
            <TrendingDown className="w-4 h-4 text-rose-500" /> Registrar gasto
          </button>
          <button onClick={() => setModal('cobro')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-xs">
            <Plus className="w-4 h-4" /> Registrar cobro
          </button>
        </div>
      </div>

      {turno && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Wallet className="w-6 h-6" /></div>
            <div>
              <p className="text-sm font-medium text-slate-500">Turno abierto desde el {formatFechaHora(turno.desde)}</p>
              <p className="text-2xl font-bold text-slate-800">{formatMoneda(turno.efectivoEsperado)} <span className="text-sm font-medium text-slate-500">en efectivo en la caja</span></p>
              <p className="text-xs text-slate-500 mt-1">
                Fondo {formatMoneda(turno.fondoInicial)} + cobros en efectivo {formatMoneda(turno.ingresosEfectivo)} − gastos en efectivo {formatMoneda(turno.egresosEfectivo)}
                {turno.ultimoCierre ? ` · último cierre: ${formatFechaHora(turno.ultimoCierre)}${turno.ultimoCierrePor ? ` (${turno.ultimoCierrePor})` : ''}` : ' · todavía no se cerró la caja'}
              </p>
              {Number(turno.efectivoEsperado) < 0 && (
                <p className="text-xs text-rose-600 font-medium mt-1">
                  Hay más gastos en efectivo que plata en la caja:{' '}
                  <button onClick={() => setPestana('gastos')} className="underline hover:text-rose-700">revisá los gastos</button>
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setModal('cierre')}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs shrink-0">
            <Lock className="w-4 h-4" /> Cerrar caja
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <TarjetaMonto title="Ingresos hoy" amount={resumen ? formatMoneda(resumen.ingresosHoy) : '—'}
          detalle={resumen ? `${resumen.cobrosHoy} ${resumen.cobrosHoy === 1 ? 'cobro' : 'cobros'} · ${detalleMetodos}` : ''}
          icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
        <TarjetaMonto title="Gastos hoy" amount={resumen ? formatMoneda(resumen.egresosHoy) : '—'}
          detalle={resumen ? (resumen.gastosHoy ? `${resumen.gastosHoy} ${resumen.gastosHoy === 1 ? 'gasto' : 'gastos'}` : 'Sin gastos hoy') : ''}
          icon={TrendingDown} color="bg-rose-50 text-rose-600" onClick={() => setPestana('gastos')} />
        <TarjetaMonto title="Resultado del mes" amount={resumen ? formatMoneda(Number(resumen.ingresosMes) - Number(resumen.egresosMes)) : '—'}
          detalle={resumen ? `Ingresos ${formatMoneda(resumen.ingresosMes)} − gastos ${formatMoneda(resumen.egresosMes)}` : ''}
          icon={CalendarDays} color="bg-violet-50 text-violet-600" />
        <TarjetaMonto title="A verificar" amount={resumen ? pendientes : '—'}
          detalle={resumen ? (pendientes > 0 ? `${formatMoneda(resumen.montoPendienteVerificar)} sin confirmar · tocá para ver` : 'Nada pendiente') : ''}
          icon={Hourglass} color="bg-amber-50 text-amber-600"
          onClick={() => { setPestana('cobros'); cambiarFiltro(!soloAVerificar); }} activa={soloAVerificar} />
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>}
      {aviso && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium">{aviso}</div>}

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 pt-4 border-b border-slate-200 flex gap-1 overflow-x-auto" role="tablist">
          {PESTANAS.map(p => (
            <button key={p.id} role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${pestana === p.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {p.texto}
            </button>
          ))}
        </div>

        {pestana === 'cobros' && (<>
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Receipt className="w-5 h-5 text-slate-400" /> Cobros</h2>
            <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
              <button onClick={() => cambiarFiltro(false)}
                className={`px-3 py-1.5 rounded-md transition-colors ${!soloAVerificar ? 'bg-white shadow-xs text-slate-800' : 'text-slate-500'}`}>Todos</button>
              <button onClick={() => cambiarFiltro(true)}
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${soloAVerificar ? 'bg-white shadow-xs text-amber-700' : 'text-slate-500'}`}>
                A verificar {pendientes > 0 && <span className="bg-amber-500 text-white rounded-full px-1.5 min-w-5 text-center">{pendientes}</span>}
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
                className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition-shadow"
              />
            </div>
            <button onClick={exportar} disabled={pagosFiltrados.length === 0} title="Exportar esta página a Excel (CSV)"
              className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
              <Download className="w-4 h-4" />
            </button>
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
                        <span className="inline-flex items-center px-2 py-1 rounded-sm bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200 whitespace-nowrap">
                          {textoMetodoPago(p.metodoPago)}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-1 whitespace-nowrap">{p.registradoPor ? `Cobró: ${p.registradoPor}` : 'Automático'}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {p.comprobante || (p.factura ? '' : '—')}
                        {p.factura && (
                          <div className={`text-[11px] font-semibold whitespace-nowrap ${p.comprobante ? 'mt-1' : ''} ${claseFactura(p.factura)}`}>
                            {textoFactura(p.factura)}
                          </div>
                        )}
                        {facturacion && esAdmin && !p.factura && p.estado === 'APROBADO' && Number(p.monto) > 0 && (
                          <button onClick={() => facturar(p)} disabled={verificando === p.idPago}
                            className="block mt-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50">
                            Facturar
                          </button>
                        )}
                      </td>
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
                        {p.estado !== 'RECHAZADO' && (
                          <button onClick={() => setComprobante(p)}
                            className="flex items-center gap-1 ml-auto mt-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600">
                            <FileText className="w-3 h-3" /> {p.factura?.estado === 'AUTORIZADO' ? 'Factura' : 'Comprobante'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Paginador pagina={pagina} nombre="cobros" onCambiar={setNumeroPagina} />
        </>)}

        {pestana === 'gastos' && <TablaGastos version={version} onCambio={cargar} />}
        {pestana === 'cierres' && <TablaCierres version={version} />}
      </div>

      {comprobante && (
        <Modal titulo="Comprobante de pago" subtitulo={`${comprobante.nombreSocio} · ${formatFecha(comprobante.fechaPago)}`}
          onClose={() => setComprobante(null)}>
          <ComprobantePago pago={comprobante} />
        </Modal>
      )}
      {modal === 'cobro' && (
        <CobroRapido onClose={() => setModal(null)}
          onCobrado={(pago, socio) => { setModal(null); setAviso(`Cobro de ${formatMoneda(pago.monto)} a ${socio.nombreCompleto} registrado.`); cargar(); }} />
      )}
      {modal === 'gasto' && (
        <GastoModal onClose={() => setModal(null)}
          onGuardado={(gasto) => {
            setModal(null);
            setAviso(`Gasto de ${formatMoneda(gasto.monto)} registrado.`);
            setPestana('gastos');
            setVersion(v => v + 1);
            cargar();
          }} />
      )}
      {modal === 'cierre' && (
        <CierreCajaModal onClose={() => setModal(null)}
          onCerrado={(cierre) => {
            setAviso(`Caja cerrada: el turno nuevo empieza con ${formatMoneda(cierre.fondoSiguiente)} de fondo.`);
            setPestana('cierres');
            setVersion(v => v + 1);
            cargar();
          }} />
      )}
    </div>
  );
};

export default Caja;
