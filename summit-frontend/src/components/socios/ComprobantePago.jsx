import React, { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import BotonesPdf from '../pdf/BotonesPdf';
import { botonSecundario } from '../Campo';
import { documentoComprobante, numeroComprobante } from '../pdf/comprobante';
import { enlaceWhatsApp, numeroWhatsApp } from '../../utils/whatsapp';
import { formatFecha, formatMoneda } from '../../utils/formato';
import { textoMetodoPago } from '../../utils/constantes';

/**
 * Comprobante de un cobro: el resumen, los botones del PDF (imprimir, descargar, compartir) y un mensaje por WhatsApp
 * con el resumen del pago (para mandarlo desde la PC, donde no se puede adjuntar el PDF con un enlace).
 */
const ComprobantePago = ({ pago }) => {
  const documento = useMemo(() => documentoComprobante(pago), [pago]);
  const mensaje = `¡Hola, ${pago.nombreSocio.split(' ')[0]}! Registramos tu pago de ${formatMoneda(pago.monto)} `
    + `(${pago.plan}, ${textoMetodoPago(pago.metodoPago).toLowerCase()}).`
    + (pago.venceMembresia ? ` Tu membresía queda paga hasta el ${formatFecha(pago.venceMembresia)}.` : '')
    + ` Comprobante N.º ${numeroComprobante(pago.idPago)}. ¡Gracias!`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comprobante N.º {numeroComprobante(pago.idPago)}</p>
        <p className="font-semibold text-slate-800">{pago.nombreSocio} · {pago.plan}</p>
        <p className="text-slate-600">
          {formatMoneda(pago.monto)} · {textoMetodoPago(pago.metodoPago)}
          {pago.venceMembresia ? ` · membresía paga hasta el ${formatFecha(pago.venceMembresia)}` : ''}
        </p>
        {pago.estado === 'PENDIENTE' && (
          <p className="text-amber-700 font-medium">A verificar: la membresía se extiende cuando un administrador lo confirme.</p>
        )}
      </div>
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
