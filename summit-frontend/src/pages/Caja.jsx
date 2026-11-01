import { useState, useEffect, useCallback } from 'react';
import { Wallet, TrendingUp, TrendingDown, CalendarDays, Calendar, Plus, Download, RefreshCw, Hourglass, Check, X, Lock, Receipt, FileText, Archive } from 'lucide-react';
import Modal from '../components/Modal';
import Encabezado from '../components/Encabezado';
import Pestanas, { usePestana } from '../components/Pestanas';
import { Buscador, botonHerramienta } from '../components/Campo';
import CobroRapido from '../components/socios/CobroRapido';
import ComprobantePago from '../components/socios/ComprobantePago';
import GastoModal from '../components/caja/GastoModal';
import CierreCajaModal from '../components/caja/CierreCajaModal';
import TablaGastos from '../components/caja/TablaGastos';
import TablaCierres from '../components/caja/TablaCierres';
import TablaFacturas from '../components/caja/TablaFacturas';
import Paginador from '../components/caja/Paginador';
import { apiFetch } from '../services/api';
import { obtenerTurno } from '../services/caja';
import { facturarCobro, useAvisoFacturacion, ESTADOS_COMPROBANTE } from '../services/facturacion';
import { useFunciones } from '../services/funciones';
import { formatFecha, formatHora, formatFechaHora, formatMoneda, descargarCsv, usuarioActual } from '../utils/formato';
import { textoMetodoPago, ESTADOS_PAGO } from '../utils/constantes';

const TarjetaMonto = ({ title, amount, detalle, icon: Icon, color, onClick, activa }) => (
  <div onClick={onClick}
    className={`bg-white px-3 py-2.5 rounded-xl border shadow-xs flex items-center justify-between gap-2 transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${activa ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'}`}>
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <h3 className="text-xl font-bold text-slate-800 leading-tight mt-0.5">{amount}</h3>
      {detalle && <p className="text-xs text-slate-500 mt-0.5 truncate" title={detalle}>{detalle}</p>}
    </div>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="w-4 h-4" />
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
const claseFactura = (f) => (f.anulada ? 'text-slate-500 line-through'
  : f.estado === 'AUTORIZADO' ? 'text-emerald-700' : f.estado === 'RECHAZADO' ? 'text-rose-700' : 'text-amber-700');

// Facturas existe solo con la factura electrónica prendida
const PESTANAS = [
  { id: 'cobros', texto: 'Cobros', icon: Receipt },
  { id: 'gastos', texto: 'Gastos', icon: TrendingDown },
  { id: 'cierres', texto: 'Cierres de caja', icon: Archive },
  { id: 'facturas', texto: 'Facturas', icon: FileText, soloConFacturacion: true },
];

/**
 * Caja y Pagos: ingresos y egresos de hoy y del mes, el turno abierto (con su cierre) y, en pestañas, los cobros
 * registrados (presenciales y débitos automáticos), los gastos, los cierres de caja anteriores y las facturas
 * electrónicas (antes, la pantalla Facturas: su dirección vieja llega a esta pestaña).
 * Solo los pagos aprobados suman. Los "a verificar" se listan aparte y el admin los confirma o rechaza.
 */
const Caja = () => {
  const esAdmin = usuarioActual()?.rol === 'ADMIN';
  const { facturacion } = useFunciones();
  const avisoFacturacion = useAvisoFacturacion(facturacion);
  const pestanas = PESTANAS
    .filter(p => facturacion || !p.soloConFacturacion)
    .map(p => (p.id === 'facturas'
      ? { ...p, contador: avisoFacturacion.rechazados + avisoFacturacion.inciertos, alerta: avisoFacturacion.rechazados > 0 }
      : p));
  const [pestana, setPestana] = usePestana(pestanas.map(p => p.id));
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
    <div className="space-y-3">
      <Encabezado titulo="Caja y Pagos" icono={Wallet}
        subtitulo="Cobros, gastos, cierres de caja y facturas. Solo suman los pagos aprobados."
        acciones={(
          <>
            <button onClick={() => setModal('gasto')}
              className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 tactil:min-h-11 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-slate-50 transition-colors shadow-xs">
              <TrendingDown className="w-4 h-4 text-rose-500" /> Registrar gasto
            </button>
            <button onClick={() => setModal('cobro')}
              className="bg-exito hover:bg-exito-oscuro text-white px-3 py-1.5 tactil:min-h-11 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-xs">
              <Plus className="w-4 h-4" /> Registrar cobro
            </button>
          </>
        )} />

      {turno && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs px-3 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Wallet className="w-4 h-4" /></div>
            <div>
              <p className="text-xs font-medium text-slate-500">Turno abierto desde el {formatFechaHora(turno.desde)}</p>
              <p className="text-xl font-bold text-slate-800 leading-tight">{formatMoneda(turno.efectivoEsperado)} <span className="text-xs font-medium text-slate-500">en efectivo en la caja</span></p>
              <p className="text-xs text-slate-500 mt-0.5">
                Fondo {formatMoneda(turno.fondoInicial)} + cobros en efectivo {formatMoneda(turno.ingresosEfectivo)} − gastos en efectivo {formatMoneda(turno.egresosEfectivo)}
                {turno.ultimoCierre ? ` · último cierre: ${formatFechaHora(turno.ultimoCierre)}${turno.ultimoCierrePor ? ` (${turno.ultimoCierrePor})` : ''}` : ' · todavía no se cerró la caja'}
              </p>
              {Number(turno.efectivoEsperado) < 0 && (
                <p className="text-xs text-rose-700 font-medium mt-0.5">
                  Hay más gastos en efectivo que plata en la caja:{' '}
                  <button onClick={() => setPestana('gastos')} className="underline hover:text-rose-700">revisá los gastos</button>
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setModal('cierre')}
            className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 tactil:min-h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs shrink-0">
            <Lock className="w-4 h-4" /> Cerrar caja
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        <TarjetaMonto title="Ingresos hoy" amount={resumen ? formatMoneda(resumen.ingresosHoy) : '—'}
          detalle={resumen ? `${resumen.cobrosHoy} ${resumen.cobrosHoy === 1 ? 'cobro' : 'cobros'} · ${detalleMetodos}` : ''}
          icon={TrendingUp} color="bg-emerald-50 text-emerald-700" />
        <TarjetaMonto title="Gastos hoy" amount={resumen ? formatMoneda(resumen.egresosHoy) : '—'}
          detalle={resumen ? (resumen.gastosHoy ? `${resumen.gastosHoy} ${resumen.gastosHoy === 1 ? 'gasto' : 'gastos'}` : 'Sin gastos hoy') : ''}
          icon={TrendingDown} color="bg-rose-50 text-rose-700" onClick={() => setPestana('gastos')} />
        <TarjetaMonto title="Resultado del mes" amount={resumen ? formatMoneda(Number(resumen.ingresosMes) - Number(resumen.egresosMes)) : '—'}
          detalle={resumen ? `Ingresos ${formatMoneda(resumen.ingresosMes)} − gastos ${formatMoneda(resumen.egresosMes)}` : ''}
          icon={CalendarDays} color="bg-violet-50 text-violet-600" />
        <TarjetaMonto title="A verificar" amount={resumen ? pendientes : '—'}
          detalle={resumen ? (pendientes > 0 ? `${formatMoneda(resumen.montoPendienteVerificar)} sin confirmar · tocá para ver` : 'Nada pendiente') : ''}
          icon={Hourglass} color="bg-amber-50 text-amber-600"
          onClick={() => { setPestana('cobros'); cambiarFiltro(!soloAVerificar); }} activa={soloAVerificar} />
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>}
      {aviso && <div className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium">{aviso}</div>}

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <Pestanas pestanas={pestanas} activa={pestana} onCambiar={setPestana} className="px-2" />

        {pestana === 'cobros' && (<>
        <div className="px-3 py-2 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs font-semibold self-start" role="group" aria-label="Qué cobros mostrar">
            <button onClick={() => cambiarFiltro(false)} aria-pressed={!soloAVerificar}
              className={`px-2.5 py-1 tactil:min-h-11 rounded-md transition-colors ${!soloAVerificar ? 'bg-white shadow-xs text-slate-800' : 'text-slate-600'}`}>Todos</button>
            <button onClick={() => cambiarFiltro(true)} aria-pressed={soloAVerificar}
              className={`px-2.5 py-1 tactil:min-h-11 rounded-md transition-colors flex items-center gap-1.5 ${soloAVerificar ? 'bg-white shadow-xs text-amber-700' : 'text-slate-600'}`}>
              A verificar {pendientes > 0 && <span className="bg-alerta text-white rounded-full px-1.5 min-w-5 text-center">{pendientes}</span>}
            </button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar por socio, DNI, plan..." className="flex-1 sm:w-60" />
            <button onClick={exportar} disabled={pagosFiltrados.length === 0} title="Exportar esta página a Excel (CSV)"
              aria-label="Exportar" className={botonHerramienta}>
              <Download className="w-3.5 h-3.5" />
            </button>
            <button onClick={cargar} title="Actualizar" aria-label="Actualizar" className={botonHerramienta}>
              <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {soloAVerificar && !esAdmin && pagos.length > 0 && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
            Estos pagos todavía no extendieron la membresía. Los confirma o rechaza un administrador.
          </div>
        )}

        {pagosFiltrados.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            {pagos.length === 0
              ? (soloAVerificar ? 'No hay pagos pendientes de verificar.' : 'Todavía no hay cobros registrados.')
              : 'Ningún cobro coincide con la búsqueda en esta página.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-3 py-2">Fecha y Hora</th>
                  <th className="px-3 py-2">Concepto / Socio</th>
                  <th className="px-3 py-2">Método</th>
                  <th className="px-3 py-2">Comprobante</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagosFiltrados.map((p) => {
                  const estado = ESTADOS_PAGO[p.estado] || ESTADOS_PAGO.APROBADO;
                  return (
                    <tr key={p.idPago} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="font-medium text-slate-700">{formatFecha(p.fechaPago)}</div>
                        <div className="text-slate-500 text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatHora(p.fechaPago)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{p.plan}</div>
                        <div className="text-slate-500 text-xs">{p.nombreSocio} · DNI {p.dniSocio}</div>
                        {detalleCobro(p) && <div className="text-xs text-slate-500">{detalleCobro(p)}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200 whitespace-nowrap">
                          {textoMetodoPago(p.metodoPago)}
                        </span>
                        <div className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">{p.registradoPor ? `Cobró: ${p.registradoPor}` : 'Automático'}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {p.comprobante || (p.factura ? '' : '—')}
                        {p.factura && (
                          <div className={`text-xs font-semibold whitespace-nowrap ${p.comprobante ? 'mt-0.5' : ''} ${claseFactura(p.factura)}`}>
                            {textoFactura(p.factura)}
                          </div>
                        )}
                        {facturacion && esAdmin && !p.factura && p.estado === 'APROBADO' && Number(p.monto) > 0 && (
                          <button onClick={() => facturar(p)} disabled={verificando === p.idPago}
                            className="block mt-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50">
                            Facturar
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${estado.clase}`}>{estado.texto}</span>
                        {p.verificadoPor && (
                          <div className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">por {p.verificadoPor}</div>
                        )}
                        {p.estado === 'PENDIENTE' && esAdmin && (
                          <div className="flex gap-1.5 mt-1.5">
                            <button onClick={() => verificar(p, true)} disabled={verificando === p.idPago}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-exito hover:bg-exito-oscuro text-white text-xs font-semibold disabled:opacity-50">
                              <Check className="w-3 h-3" /> Aprobar
                            </button>
                            <button onClick={() => verificar(p, false)} disabled={verificando === p.idPago}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold disabled:opacity-50">
                              <X className="w-3 h-3" /> Rechazar
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {p.estado === 'APROBADO' && <span className="font-bold text-emerald-700">+{formatMoneda(p.monto)}</span>}
                        {p.estado === 'PENDIENTE' && <span className="font-bold text-amber-700">{formatMoneda(p.monto)}</span>}
                        {p.estado === 'RECHAZADO' && <span className="font-medium text-slate-500 line-through">{formatMoneda(p.monto)}</span>}
                        {p.estado !== 'RECHAZADO' && (
                          <button onClick={() => setComprobante(p)}
                            className="flex items-center gap-1 ml-auto mt-0.5 text-xs font-semibold text-slate-500 hover:text-blue-600">
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
        {pestana === 'facturas' && <TablaFacturas />}
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
