import { useState } from 'react';
import { useCarga } from '../hooks/useCarga';
import { FileText, RefreshCw, Send, AlertTriangle, Settings, FlaskConical } from 'lucide-react';
import { Link } from 'react-router';
import Paginador from '../components/caja/Paginador';
import DetalleComprobante from '../components/facturacion/DetalleComprobante';
import {
  listarComprobantes, obtenerEstadoFacturacion, procesarPendientes, actualizarAvisoFacturacion, nombreComprobante,
  enCurso, ESTADOS_COMPROBANTE, AMBIENTES,
} from '../services/facturacion';
import { formatFecha, formatFechaHora, formatMoneda, usuarioActual } from '../utils/formato';

const FILTROS = [
  { id: null, texto: 'Todas' },
  { id: 'PENDIENTE', texto: 'Pendientes' },
  { id: 'INCIERTO', texto: 'Sin confirmar' },
  { id: 'RECHAZADO', texto: 'Rechazadas' },
  { id: 'AUTORIZADO', texto: 'Autorizadas' },
];

/**
 * Facturas electrónicas de ARCA: cada cobro aprobado sale con la suya, sola. Acá se ve en qué anda cada una, se manda
 * ya lo que espera un reintento y, desde el detalle, el admin reintenta una rechazada o la anula con nota de crédito.
 */
const Facturas = () => {
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

  const ambiente = estado?.ambiente ? AMBIENTES[estado.ambiente] : null;
  const esperando = estado ? estado.pendientes + estado.inciertos : 0;
  const comprobantes = pagina?.content || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Facturas</h1>
          <p className="text-sm text-slate-500">Cada cobro aprobado sale con su factura electrónica de ARCA, sin hacer nada.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {esAdmin && (
            <Link to="/ajustes/facturacion" className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Datos fiscales
            </Link>
          )}
          <button onClick={cargar} disabled={cargando}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center gap-2 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
      </div>

      {ambiente && !estado.deVerdad && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3">
          <FlaskConical className="w-5 h-5 shrink-0 mt-0.5" />
          <p><span className="font-semibold">{ambiente.texto}.</span> {ambiente.detalle}</p>
        </div>
      )}
      {estado && !estado.datosCompletos && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            Faltan datos fiscales ({estado.faltantes.join(', ')}): hasta completarlos no sale ninguna factura.
            {esAdmin ? <> Cargalos en <Link to="/ajustes/facturacion" className="underline font-semibold">Ajustes &gt; Facturación</Link>.</> : ' Avisale a un administrador.'}
          </p>
        </div>
      )}
      {error && <p className="p-4 rounded-xl bg-rose-50 text-rose-700 text-sm font-medium">{error}</p>}
      {aviso && <p className="p-4 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">{aviso}</p>}

      {estado && (esperando > 0 || estado.rechazados > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {esperando > 0 && (
            <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-xs space-y-3">
              <p className="text-sm font-medium text-slate-500">Esperando a ARCA</p>
              <p className="text-2xl font-bold text-slate-800">{esperando} {esperando === 1 ? 'factura' : 'facturas'}</p>
              {estado.ultimoError && <p className="text-xs text-amber-800">{estado.ultimoError}</p>}
              <button onClick={mandarAhora} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700">
                <Send className="w-4 h-4" /> Mandar ahora
              </button>
            </div>
          )}
          {estado.rechazados > 0 && (
            <button onClick={() => { setFiltro('RECHAZADO'); setNumeroPagina(0); }}
              className="text-left bg-white p-5 rounded-xl border border-rose-200 shadow-xs hover:shadow-md transition-shadow">
              <p className="text-sm font-medium text-slate-500">Rechazadas por ARCA</p>
              <p className="text-2xl font-bold text-rose-700">{estado.rechazados}</p>
              <p className="text-xs text-slate-500 mt-1">Abrí cada una para ver el motivo{esAdmin ? ' y reintentarla' : ''}.</p>
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 pt-4 border-b border-slate-200 flex gap-1 overflow-x-auto" role="tablist">
          {FILTROS.map((f) => (
            <button key={f.texto} role="tab" aria-selected={filtro === f.id} onClick={() => { setFiltro(f.id); setNumeroPagina(0); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${filtro === f.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {f.texto}
            </button>
          ))}
        </div>

        {comprobantes.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">
            {cargando ? 'Cargando…' : filtro ? 'No hay comprobantes en este estado.' : 'Todavía no hay facturas: salen solas al cobrar.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Comprobante</th>
                  <th className="px-6 py-4">Socio</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comprobantes.map((c) => {
                  const chip = ESTADOS_COMPROBANTE[c.estado];
                  return (
                    <tr key={c.idComprobante} onClick={() => setDetalle(c.idComprobante)} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-700">{c.fecha ? formatFecha(c.fecha) : formatFecha(c.creado)}</div>
                        <div className="text-slate-400 text-xs mt-0.5">Cobro del {formatFechaHora(c.fechaPago)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" /> {nombreComprobante(c)}
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5">
                          {c.notaCredito ? `Anula la ${c.asociado}` : c.docTipo === 96 ? `A nombre de ${c.receptorNombre}` : c.docTipo ? 'A consumidor final' : c.plan}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{c.nombreSocio}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${chip.clase}`}>{chip.texto}</span>
                        {c.anulada && <span className="ml-1.5 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border bg-slate-100 text-slate-600 border-slate-200">Anulada</span>}
                        {(c.estado === 'RECHAZADO' || enCurso(c.estado)) && c.ultimoError && (
                          <div className="text-[11px] text-slate-500 mt-1 max-w-xs truncate" title={c.ultimoError}>{c.ultimoError}</div>
                        )}
                      </td>
                      <td className={`px-6 py-4 text-right whitespace-nowrap font-bold ${c.notaCredito ? 'text-rose-600' : 'text-slate-800'}`}>
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
      </div>

      {detalle && <DetalleComprobante idComprobante={detalle} onClose={() => setDetalle(null)} onCambio={cargar} />}
    </div>
  );
};

export default Facturas;
