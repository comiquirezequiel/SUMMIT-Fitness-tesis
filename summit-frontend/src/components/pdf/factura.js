// Documento PDF de una factura o nota de crédito electrónica (ver index.js). Liviano: FacturaPdf.jsx, la librería y el
// código QR se cargan recién al generarlo.
import { datosDelGimnasio, imagenParaPdf } from './index';
import { formatMoneda } from '../../utils/formato';
import { nombreComprobante } from '../../services/facturacion';

/** - comprobante: autorizado, como lo devuelve /api/facturacion (ComprobanteFiscalDTO) */
export const documentoFactura = (comprobante) => {
  const nombre = nombreComprobante(comprobante);
  const queEs = comprobante.notaCredito ? 'la nota de crédito' : 'la factura';
  return {
    nombreArchivo: `${nombre} ${comprobante.nombreSocio}.pdf`,
    titulo: nombre,
    texto: `¡Hola, ${comprobante.nombreSocio.split(' ')[0]}! Te paso ${queEs} de tu pago de ${formatMoneda(comprobante.total)}.`,
    cargar: () => import('./FacturaPdf'),
    datos: async () => {
      const [gimnasio, { qrParaPdf }] = await Promise.all([datosDelGimnasio(), import('./qr')]);
      return { comprobante, gimnasio, logoUrl: await imagenParaPdf(gimnasio?.logoUrl), qr: qrParaPdf(comprobante.qrUrl) };
    },
  };
};
