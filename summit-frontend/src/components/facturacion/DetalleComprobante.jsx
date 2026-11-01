import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCcw, Ban, FilePlus2, Loader2 } from 'lucide-react';
import Modal from '../Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import BotonesPdf from '../pdf/BotonesPdf';
import { documentoFactura } from '../pdf/factura';
import {
  obtenerComprobante, anularFactura, reintentarComprobante, facturarCobro, enCurso, nombreComprobante, cuitConGuiones,
  ESTADOS_COMPROBANTE,
} from '../../services/facturacion';
import { formatFecha, formatFechaHora, formatMoneda, usuarioActual } from '../../utils/formato';
import { textoMetodoPago } from '../../utils/constantes';

// Después de una acción (anular, reintentar, facturar) se espera la respuesta de ARCA hasta este tiempo
const ESPERA_MS = 20000;

// El backend describe los comprobantes para usarlos dentro de una oración ("factura C 00002-00000154")
const capitalizar = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '');

const Dato = ({ etiqueta, children }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</dt>
    <dd className="text-sm text-slate-800 mt-0.5">{children}</dd>
  </div>
);

/**
 * Detalle de una factura o nota de crédito: lo que va impreso, la respuesta de ARCA y las acciones del admin
 * (reintentar una rechazada, anular con nota de crédito, volver a facturar el cobro de una anulada).
 */
const DetalleComprobante = ({ idComprobante, onClose, onCambio }) => {
  const esAdmin = usuarioActual()?.rol === 'ADMIN';
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [accion, setAccion] = useState(null); // 'anular' | 'facturar'
  const [motivo, setMotivo] = useState('');
  const [conDni, setConDni] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [esperarHasta, setEsperarHasta] = useState(0);
  const [mostrado, setMostrado] = useState(idComprobante);

  const cargar = useCallback(async () => {
    try {
      setC(await obtenerComprobante(mostrado));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [mostrado]);

  useEffect(() => { cargar(); }, [cargar]);

  // Mientras ARCA no responde (después de una acción), se vuelve a consultar cada 1,5 segundos
  const esperando = c && Date.now() < esperarHasta && (enCurso(c.estado) || enCurso(c.estadoNotaCredito));
  useEffect(() => {
    if (!esperando) return undefined;
    const temporizador = setTimeout(cargar, 1500);
    return () => clearTimeout(temporizador);
  }, [esperando, c, cargar]);

  const documento = useMemo(() => (c?.estado === 'AUTORIZADO' ? documentoFactura(c) : null), [c]);

  const ejecutar = async (hacer) => {
    setProcesando(true);
    setError('');
    try {
      const resultado = await hacer();
      setAccion(null);
      setMotivo('');
      setEsperarHasta(Date.now() + ESPERA_MS);
      if (resultado?.idComprobante && resultado.idComprobante !== mostrado && !resultado.notaCredito) {
        setMostrado(resultado.idComprobante); // la factura nueva del cobro
      } else {
        await cargar();
      }
      onCambio?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  };

  const estado = c ? ESTADOS_COMPROBANTE[c.estado] : null;
  const puedeAnular = esAdmin && c && !c.notaCredito && c.estado === 'AUTORIZADO' && !c.idNotaCredito;
  const puedeFacturarDeNuevo = esAdmin && c && !c.notaCredito && c.anulada;

  return (
    <Modal titulo={c ? nombreComprobante(c) : 'Comprobante'} ancho="max-w-2xl" onClose={onClose}
      subtitulo={c ? `${c.nombreSocio} · ${formatMoneda(c.total)}` : ''}>
      {!c && !error && <p className="text-sm text-slate-500">Cargando…</p>}
      {error && <p className="mb-3 p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</p>}
      {c && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${estado.clase}`}>{estado.texto}</span>
            {c.anulada && <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-slate-100 text-slate-600 border-slate-200">Anulada</span>}
            {!c.deVerdad && <span className="text-xs text-slate-500">Sin validez fiscal ({c.ambiente === 'SIMULADOR' ? 'simulador' : 'pruebas de ARCA'})</span>}
            {esperando && <span className="flex items-center gap-1.5 text-xs text-sky-700 font-medium"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Esperando a ARCA…</span>}
          </div>

          {c.ultimoError && (
            <p className={`p-3 rounded-lg text-sm ${c.estado === 'RECHAZADO' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
              {c.ultimoError}
              {enCurso(c.estado) && c.proximoIntento && <span className="block text-xs mt-1">Próximo intento: {formatFechaHora(c.proximoIntento)}</span>}
            </p>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {c.cae && <Dato etiqueta="CAE">{c.cae} · vence el {formatFecha(c.caeVencimiento)}</Dato>}
            {c.fecha && <Dato etiqueta="Fecha de emisión">{formatFecha(c.fecha)}</Dato>}
            <Dato etiqueta="Receptor">
              {c.docTipo === 96 ? `${c.receptorNombre} · DNI ${c.docNro}` : c.docTipo ? 'A consumidor final' : '—'}
            </Dato>
            <Dato etiqueta="Cobro">{c.plan} · {textoMetodoPago(c.metodoPago)} · {formatFechaHora(c.fechaPago)}</Dato>
            {c.servicioDesde && <Dato etiqueta="Período facturado">{formatFecha(c.servicioDesde)} al {formatFecha(c.servicioHasta)}</Dato>}
            {c.letra === 'B' && c.iva != null && <Dato etiqueta="IVA contenido">{formatMoneda(c.iva)} (neto {formatMoneda(c.neto)})</Dato>}
            {c.emisorCuit && <Dato etiqueta="Emisor">{c.emisorRazonSocial} · CUIT {cuitConGuiones(c.emisorCuit)}</Dato>}
            {c.notaCredito && <Dato etiqueta="Anula">{capitalizar(c.asociado)}{c.motivo ? ` · ${c.motivo}` : ''}</Dato>}
            {c.idNotaCredito && <Dato etiqueta="Nota de crédito">{capitalizar(c.descripcionNotaCredito)} ({ESTADOS_COMPROBANTE[c.estadoNotaCredito]?.texto.toLowerCase()})</Dato>}
            {c.solicitadoPor && <Dato etiqueta="Pedida por">{c.solicitadoPor}</Dato>}
          </dl>

          {c.observaciones && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Respuesta de ARCA</p>
              <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap font-sans">{c.observaciones}</pre>
            </div>
          )}

          {documento && <BotonesPdf documento={documento} />}

          {accion === 'anular' && (
            <form className="p-3 rounded-xl border border-rose-100 bg-rose-50/40 space-y-3"
              onSubmit={(e) => { e.preventDefault(); ejecutar(() => anularFactura(c.idComprobante, motivo)); }}>
              <p className="text-sm text-slate-700">
                Se emite una nota de crédito {c.letra} por el total, que anula esta factura ante ARCA. No cambia la caja ni la
                membresía: si devolviste la plata, cargala como gasto.
              </p>
              <Campo label="Motivo (queda registrado)" required>
                <input className={inputClass} value={motivo} maxLength={200} autoFocus
                  onChange={(e) => setMotivo(e.target.value)} placeholder="Por ejemplo: se cobró dos veces" />
              </Campo>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className={botonSecundario} onClick={() => setAccion(null)}>Cancelar</button>
                <button type="submit" disabled={procesando || motivo.trim().length < 3}
                  className={`${botonPrimario} bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300`}>
                  <Ban className="w-4 h-4" /> {procesando ? 'Pidiendo…' : 'Emitir nota de crédito'}
                </button>
              </div>
            </form>
          )}

          {accion === 'facturar' && (
            <form className="p-3 rounded-xl border border-blue-100 bg-blue-50/40 space-y-3"
              onSubmit={(e) => { e.preventDefault(); ejecutar(() => facturarCobro(c.idPago, conDni)); }}>
              <p className="text-sm text-slate-700">Se emite una factura nueva para el mismo cobro.</p>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={conDni} onChange={(e) => setConDni(e.target.checked)} className="w-4 h-4" />
                A nombre del socio, con su DNI (si no, sale a consumidor final)
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className={botonSecundario} onClick={() => setAccion(null)}>Cancelar</button>
                <button type="submit" disabled={procesando} className={botonPrimario}>
                  <FilePlus2 className="w-4 h-4" /> {procesando ? 'Pidiendo…' : 'Facturar de nuevo'}
                </button>
              </div>
            </form>
          )}

          {!accion && (esAdmin && (c.estado === 'RECHAZADO' || puedeAnular || puedeFacturarDeNuevo)) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {c.estado === 'RECHAZADO' && (
                <button className={botonPrimario} disabled={procesando}
                  onClick={() => ejecutar(() => reintentarComprobante(c.idComprobante))}>
                  <RotateCcw className="w-4 h-4" /> Reintentar
                </button>
              )}
              {puedeAnular && (
                <button className={`${botonSecundario} text-rose-700 border-rose-200 hover:bg-rose-50`} onClick={() => setAccion('anular')}>
                  <Ban className="w-4 h-4" /> Anular con nota de crédito
                </button>
              )}
              {puedeFacturarDeNuevo && (
                <button className={botonSecundario} onClick={() => setAccion('facturar')}>
                  <FilePlus2 className="w-4 h-4" /> Facturar el cobro de nuevo
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default DetalleComprobante;
