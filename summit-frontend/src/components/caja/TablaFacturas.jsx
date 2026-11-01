import { useState } from 'react';
import { Link } from 'react-router';
import { FileText, RefreshCw, Send, AlertTriangle, Settings, FlaskConical } from 'lucide-react';
import { useCarga } from '../../hooks/useCarga';
import Paginador from './Paginador';
import DetalleComprobante from '../facturacion/DetalleComprobante';
import { botonHerramienta } from '../Campo';
import {
  listarComprobantes, obtenerEstadoFacturacion, procesarPendientes, actualizarAvisoFacturacion, nombreComprobante,
  enCurso, ESTADOS_COMPROBANTE, AMBIENTES,
} from '../../services/facturacion';
import { formatFecha, formatFechaHora, formatMoneda, usuarioActual } from '../../utils/formato';

const FILTROS = [
  { id: null, texto: 'Todas' },
  { id: 'PENDIENTE', texto: 'Pendientes' },
  { id: 'INCIERTO', texto: 'Sin confirmar' },
  { id: 'RECHAZADO', texto: 'Rechazadas' },
  { id: 'AUTORIZADO', texto: 'Autorizadas' },
];

/**
 * Facturas electrónicas de ARCA (pestaña de Caja y Pagos; antes era una pantalla aparte): cada cobro aprobado sale con
 * la suya, sola. Acá se ve en qué anda cada una, se manda ya lo que espera un reintento y, desde el detalle, el admin
 * reintenta una rechazada o la anula con nota de crédito.
 */
const TablaFacturas = () => {
  const esAdmin = usuarioActual()?.rol === 'ADMIN';
  const [filtro, setFiltro] = useState(null);
  const [numeroPagina, setNumeroPagina] = useState(0);
  const [aviso, setAviso] = useState('');
  const [detalle, setDetalle] = useState(null); // id del comprobante abierto

  const { datos, cargando, error, setError, cargar } = useCarga(async () => {
    try {
      const [estado, pagina] = await Promise.all([obtenerEstadoFacturacion(), listarComprobantes(filtro, numeroPagina)]);
      return { estado, pagina };
    } finally {
      actualizarAvisoFacturacion();
    }
  }, [filtro, numeroPagina]);
  const estado = datos?.estado ?? null;
  const pagina = datos?.pagina ?? null;

  const mandarAhora = async () => {
    try {
      await procesarPendientes();
      setAviso('Se mandaron a ARCA las facturas que esperaban. En unos segundos se actualiza la lista.');
      setTimeout(cargar, 2500);
    } catch (e) {
      setError(e.message);
    }
  };

  const elegirFiltro = (id) => {
    setFiltro(id);
    setNumeroPagina(0);
  };

  const ambiente = estado?.ambiente ? AMBIENTES[estado.ambiente] : null;
  const esperando = estado ? estado.pendientes + estado.inciertos : 0;
  const comprobantes = pagina?.content || [];

  return (
    <>
      <div className="px-3 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs font-semibold overflow-x-auto hide-scrollbar" role="group" aria-label="Estado de la factura">
          {FILTROS.map((f) => (
            <button key={f.texto} onClick={() => elegirFiltro(f.id)} aria-pressed={filtro === f.id}
              className={`px-2.5 py-1 tactil:min-h-11 rounded-md whitespace-nowrap transition-colors ${filtro === f.id ? 'bg-white shadow-xs text-slate-800' : 'text-slate-600 hover:text-slate-800'}`}>
              {f.texto}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {esAdmin && (
            <Link to="/ajustes/reglas?vista=facturacion" className={botonHerramienta}>
              <Settings className="w-3.5 h-3.5" /> Datos fiscales
            </Link>
          )}
          <button onClick={cargar} disabled={cargando} className={botonHerramienta}>
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
      </div>

      {ambiente && !estado.deVerdad && (
        <p className="px-3 py-2 border-b border-amber-100 bg-amber-50 text-amber-900 text-xs flex items-start gap-2">
          <FlaskConical className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span><span className="font-semibold">{ambiente.texto}.</span> {ambiente.detalle}</span>
        </p>
      )}
      {estado && !estado.datosCompletos && (
        <p className="px-3 py-2 border-b border-rose-100 bg-rose-50 text-rose-800 text-xs flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>
            Faltan datos fiscales ({estado.faltantes.join(', ')}): hasta completarlos no sale ninguna factura.
            {esAdmin
              ? <> Cargalos en <Link to="/ajustes/reglas?vista=facturacion" className="underline font-semibold">Configuración y reglas &gt; Facturación</Link>.</>
              : ' Avisale a un administrador.'}
          </span>
        </p>
      )}
      {error && <p className="px-3 py-2 border-b border-rose-100 bg-rose-50 text-rose-700 text-sm font-medium">{error}</p>}
      {aviso && <p className="px-3 py-2 border-b border-emerald-100 bg-emerald-50 text-emerald-700 text-sm font-medium">{aviso}</p>}

      {estado && (esperando > 0 || estado.rechazados > 0) && (
        <div className="px-3 py-2 border-b border-slate-100 flex flex-wrap gap-2 text-xs">
          {esperando > 0 && (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
              <span><b>{esperando}</b> {esperando === 1 ? 'factura esperando' : 'facturas esperando'} a ARCA</span>
              {estado.ultimoError && <span className="text-amber-700 truncate max-w-xs" title={estado.ultimoError}>· {estado.ultimoError}</span>}
              <button onClick={mandarAhora} className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700">
                <Send className="w-3 h-3" /> Mandar ahora
              </button>
            </span>
          )}
          {estado.rechazados > 0 && (
            <button onClick={() => elegirFiltro('RECHAZADO')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
              <AlertTriangle className="w-3 h-3" />
              <span><b>{estado.rechazados}</b> {estado.rechazados === 1 ? 'rechazada' : 'rechazadas'} por ARCA · abrí cada una para ver el motivo{esAdmin ? ' y reintentarla' : ''}</span>
            </button>
          )}
        </div>
      )}

      {comprobantes.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">
          {cargando ? 'Cargando…' : filtro ? 'No hay comprobantes en este estado.' : 'Todavía no hay facturas: salen solas al cobrar.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Comprobante</th>
                <th className="px-3 py-2">Socio</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comprobantes.map((c) => {
                const chip = ESTADOS_COMPROBANTE[c.estado];
                return (
                  <tr key={c.idComprobante} onClick={() => setDetalle(c.idComprobante)} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-medium text-slate-700">{c.fecha ? formatFecha(c.fecha) : formatFecha(c.creado)}</div>
                      <div className="text-slate-500 text-xs">Cobro del {formatFechaHora(c.fechaPago)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {nombreComprobante(c)}
                      </div>
                      <div className="text-slate-500 text-xs">
                        {c.notaCredito ? `Anula la ${c.asociado}` : c.docTipo === 96 ? `A nombre de ${c.receptorNombre}` : c.docTipo ? 'A consumidor final' : c.plan}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{c.nombreSocio}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${chip.clase}`}>{chip.texto}</span>
                      {c.anulada && <span className="ml-1 inline-flex px-1.5 py-0.5 rounded-full text-xs font-semibold border bg-slate-100 text-slate-600 border-slate-200">Anulada</span>}
                      {(c.estado === 'RECHAZADO' || enCurso(c.estado)) && c.ultimoError && (
                        <div className="text-xs text-slate-500 mt-0.5 max-w-xs truncate" title={c.ultimoError}>{c.ultimoError}</div>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap font-bold ${c.notaCredito ? 'text-rose-700' : 'text-slate-800'}`}>
                      {c.notaCredito ? '− ' : ''}{formatMoneda(c.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Paginador pagina={pagina} nombre="comprobantes" onCambiar={setNumeroPagina} />

      {detalle && <DetalleComprobante idComprobante={detalle} onClose={() => setDetalle(null)} onCambio={cargar} />}
    </>
  );
};

export default TablaFacturas;
