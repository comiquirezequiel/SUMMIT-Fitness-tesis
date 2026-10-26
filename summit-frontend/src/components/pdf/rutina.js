// Documento PDF de una rutina (ver index.js). Liviano: RutinaPdf.jsx y la librería se cargan recién al generarlo.
import { datosDelGimnasio, imagenParaPdf } from './index';
import { hoyIso } from '../../utils/formato';

/**
 * - rutina: la de GET /api/rutinas/{id}, con sus ejercicios
 * - objetivoSocio: el objetivo del perfil del socio, por si la rutina no tiene uno propio
 * - logoUrl: logo del gimnasio para el encabezado (opcional). Si no se pasa, se usa gimnasio.logoUrl cuando el
 *   backend lo devuelva. Cualquier formato que muestre el navegador; si no se puede bajar, el PDF sale sin logo.
 */
export const documentoRutina = (rutina, { objetivoSocio, logoUrl } = {}) => {
  const nombre = rutina.nombreSocio || 'socio';
  return {
    nombreArchivo: `Rutina ${nombre}.pdf`,
    titulo: `Rutina de ${nombre}`,
    texto: `¡Hola, ${nombre.split(' ')[0]}! Te paso tu rutina “${rutina.nombre}”.`,
    cargar: () => import('./RutinaPdf'),
    datos: async () => {
      const gimnasio = await datosDelGimnasio();
      const logo = await imagenParaPdf(logoUrl || gimnasio?.logoUrl);
      return { rutina, objetivo: rutina.objetivo || objetivoSocio, gimnasio, logo, emitida: hoyIso() };
    },
  };
};
