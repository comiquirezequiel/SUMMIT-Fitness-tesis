// Documento PDF del comprobante de un cobro (ver index.js). Liviano: ComprobantePdf.jsx y la librería se cargan recién
// al generarlo.
import { datosDelGimnasio, imagenParaPdf } from './index';
import { formatMoneda } from '../../utils/formato';

/** Número del comprobante a partir del id del cobro: 000123 */
export const numeroComprobante = (idPago) => String(idPago).padStart(6, '0');

/** - pago: el cobro como lo devuelve /api/pagos (PagoListadoDTO) */
export const documentoComprobante = (pago) => {
  const numero = numeroComprobante(pago.idPago);
  return {
    nombreArchivo: `Comprobante ${numero} ${pago.nombreSocio}.pdf`,
    titulo: `Comprobante de pago ${numero}`,
    texto: `¡Hola, ${pago.nombreSocio.split(' ')[0]}! Te paso el comprobante de tu pago de ${formatMoneda(pago.monto)}.`,
    cargar: () => import('./ComprobantePdf'),
    datos: async () => {
      const gimnasio = await datosDelGimnasio();
      return { pago, numero, gimnasio, logoUrl: await imagenParaPdf(gimnasio?.logoUrl) };
    },
  };
};
