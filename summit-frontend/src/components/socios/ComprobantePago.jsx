import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Loader2, AlertTriangle, FileCheck2 } from 'lucide-react';
import BotonesPdf from '../pdf/BotonesPdf';
import { botonSecundario } from '../Campo';
import { documentoComprobante, numeroComprobante } from '../pdf/comprobante';
import { documentoFactura } from '../pdf/factura';
import { useFunciones } from '../../services/funciones';
import { comprobantesDelCobro, enCurso, facturaDelCobro, nombreComprobante } from '../../services/facturacion';
import { enlaceWhatsApp, numeroWhatsApp } from '../../utils/whatsapp';
import { formatFecha, formatMoneda } from '../../utils/formato';
import { textoMetodoPago } from '../../utils/constantes';

// Recién cobrado, se espera la autorización de ARCA hasta este tiempo (casi siempre llega en un segundo)
const ESPERA_MS = 20000;
const CADA_MS = 1500;

/**
 * Comprobante de un cobro: el resumen, los botones del PDF (imprimir, descargar, compartir) y un mensaje por WhatsApp
 * con el resumen del pago (para mandarlo desde la PC, donde no se puede adjuntar el PDF con un enlace).
 * Con la factura electrónica prendida, el PDF es la factura (con CAE y QR) apenas ARCA la autoriza. Si tarda, queda el
 * comprobante común: la factura sale sola y se ve después en Facturas.
 */
const ComprobantePago = ({ pago }) => {
  const { facturacion } = useFunciones();
  const [factura, setFactura] = useState(null);
  const [esperando, setEsperando] = useState(false);

  useEffect(() => {
    if (!facturacion || pago.estado !== 'APROBADO') return undefined;
    let vigente = true;
    let temporizador = null;
    const inicio = Date.now();
    const consultar = async () => {
      try {
        const encontrada = facturaDelCobro(await comprobantesDelCobro(pago.idPago));
        if (!vigente) return;
        setFactura(encontrada);
        const seguir = encontrada && enCurso(encontrada.estado) && Date.now() - inicio < ESPERA_MS;
        setEsperando(Boolean(seguir));
        if (seguir) temporizador = setTimeout(consultar, CADA_MS);
      } catch {
        if (vigente) setEsperando(false);
      }
    };
    consultar();
    return () => { vigente = false; clearTimeout(temporizador); };
  }, [facturacion, pago.idPago, pago.estado]);

  const autorizada = factura?.estado === 'AUTORIZADO' ? factura : null;
  const documento = useMemo(() => (autorizada ? documentoFactura(autorizada) : documentoComprobante(pago)), [autorizada, pago]);
  const referencia = autorizada ? `${nombreComprobante(autorizada)} (CAE ${autorizada.cae})` : `Comprobante N.º ${numeroComprobante(pago.idPago)}`;
  const mensaje = `¡Hola, ${pago.nombreSocio.split(' ')[0]}! Registramos tu pago de ${formatMoneda(pago.monto)} `
    + `(${pago.plan}, ${textoMetodoPago(pago.metodoPago).toLowerCase()}).`
    + (pago.venceMembresia ? ` Tu membresía queda paga hasta el ${formatFecha(pago.venceMembresia)}.` : '')
    + ` ${referencia}. ¡Gracias!`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {autorizada ? nombreComprobante(autorizada) : `Comprobante N.º ${numeroComprobante(pago.idPago)}`}
        </p>
        <p className="font-semibold text-slate-800">{pago.nombreSocio} · {pago.plan}</p>
        <p className="text-slate-600">
          {formatMoneda(pago.monto)} · {textoMetodoPago(pago.metodoPago)}
          {pago.venceMembresia ? ` · membresía paga hasta el ${formatFecha(pago.venceMembresia)}` : ''}
        </p>
        {pago.estado === 'PENDIENTE' && (
          <p className="text-amber-700 font-medium">A verificar: la membresía se extiende cuando un administrador lo confirme.</p>
        )}
        {autorizada && (
          <p className="text-emerald-700 font-medium">
            <FileCheck2 className="w-4 h-4 inline -mt-0.5 mr-1.5" />
            Autorizada por ARCA · CAE {autorizada.cae}
            {!autorizada.deVerdad && <span className="text-slate-500 font-normal"> (sin validez fiscal: {autorizada.ambiente === 'SIMULADOR' ? 'simulador' : 'pruebas'})</span>}
          </p>
        )}
        {autorizada?.anulada && (
          <p className="text-rose-700 font-medium">Anulada con la {autorizada.descripcionNotaCredito}.</p>
        )}
      </div>

      {esperando && (
        <p className="flex items-center gap-2 text-sm text-sky-700 font-medium">
          <Loader2 className="w-4 h-4 animate-spin" /> Pidiendo la factura a ARCA…
        </p>
      )}
      {!esperando && factura && enCurso(factura.estado) && (
        <p className="flex items-start gap-2 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          La factura todavía no salió (ARCA no respondió). Mientras tanto podés dar este comprobante: la factura sale sola y
          queda en Facturas.
        </p>
      )}
      {factura?.estado === 'RECHAZADO' && (
        <p className="flex items-start gap-2 text-sm text-rose-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          ARCA rechazó la factura ({factura.ultimoError || 'sin motivo'}). Un administrador la revisa en Facturas; mientras
          tanto podés dar este comprobante.
        </p>
      )}

      <BotonesPdf documento={documento} />
      <a href={enlaceWhatsApp(pago.telefonoSocio, mensaje)} target="_blank" rel="noopener noreferrer"
        className={`${botonSecundario} bg-white w-full sm:w-auto inline-flex`}>
        <MessageCircle className="w-4 h-4 text-emerald-600" />
        {numeroWhatsApp(pago.telefonoSocio) ? 'Avisarle por WhatsApp' : 'Mandar por WhatsApp (elegís el contacto)'}
      </a>
    </div>
  );
};

export default ComprobantePago;
