import { useSyncExternalStore } from 'react';
import { pedirJson, conJson } from './api';

// Factura electrónica de ARCA (FACTURACION.md). Cada cobro aprobado sale con su factura: el backend la pide en segundo
// plano. Desde el panel se ven los comprobantes, se reintentan los rechazados y se anulan con una nota de crédito.

export const obtenerEstadoFacturacion = () => pedirJson('/facturacion/estado', {}, 'No se pudo leer el estado de la facturación');
export const obtenerDatosFiscales = () => pedirJson('/facturacion/datos-fiscales', {}, 'No se pudieron leer los datos fiscales');
export const guardarDatosFiscales = (datos) =>
  pedirJson('/facturacion/datos-fiscales', conJson('PUT', datos), 'No se pudieron guardar los datos fiscales');
export const probarConexion = () => pedirJson('/facturacion/probar-conexion', { method: 'POST' }, 'No se pudo probar la conexión con ARCA');

export const listarComprobantes = (estado, pagina, tamanio = 20) =>
  pedirJson(`/facturacion/comprobantes?page=${pagina}&size=${tamanio}${estado ? `&estado=${estado}` : ''}`, {},
    'No se pudieron leer los comprobantes');
export const obtenerComprobante = (id) => pedirJson(`/facturacion/comprobantes/${id}`, {}, 'No se pudo leer el comprobante');
export const comprobantesDelCobro = (idPago) => pedirJson(`/facturacion/pagos/${idPago}`, {}, 'No se pudo leer la factura del cobro');
export const facturarCobro = (idPago, conDni) =>
  pedirJson(`/facturacion/pagos/${idPago}/facturar`, conJson('POST', { conDni }), 'No se pudo facturar el cobro');
export const anularFactura = (id, motivo) =>
  pedirJson(`/facturacion/comprobantes/${id}/anular`, conJson('POST', { motivo }), 'No se pudo anular la factura');
export const reintentarComprobante = (id) =>
  pedirJson(`/facturacion/comprobantes/${id}/reintentar`, { method: 'POST' }, 'No se pudo reintentar el comprobante');
export const procesarPendientes = () => pedirJson('/facturacion/procesar', { method: 'POST' }, 'No se pudo mandar lo pendiente');

export const ESTADOS_COMPROBANTE = {
  PENDIENTE: { texto: 'Pendiente', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  ENVIANDO: { texto: 'Enviándose', clase: 'bg-sky-50 text-sky-700 border-sky-200' },
  INCIERTO: { texto: 'Confirmando con ARCA', clase: 'bg-sky-50 text-sky-700 border-sky-200' },
  AUTORIZADO: { texto: 'Autorizada', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  RECHAZADO: { texto: 'Rechazada', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export const AMBIENTES = {
  SIMULADOR: {
    texto: 'Simulador',
    detalle: 'Las facturas las autoriza un ARCA de mentira, adentro del sistema: sirven para probar y mostrar, pero no tienen validez fiscal.',
  },
  HOMOLOGACION: {
    texto: 'Pruebas de ARCA (homologación)',
    detalle: 'ARCA autoriza las facturas en su ambiente de pruebas: no tienen validez fiscal.',
  },
  PRODUCCION: { texto: 'Producción', detalle: 'Las facturas son reales y quedan registradas en ARCA.' },
};

export const CONDICIONES_IVA = [
  { valor: 'MONOTRIBUTO', texto: 'Monotributista', detalle: 'Factura C: el precio no discrimina IVA.' },
  { valor: 'RESPONSABLE_INSCRIPTO', texto: 'Responsable inscripto', detalle: 'Factura B al consumidor final, con el IVA contenido.' },
];

/** Mientras ARCA no dio una respuesta definitiva. */
export const enCurso = (estado) => ['PENDIENTE', 'ENVIANDO', 'INCIERTO'].includes(estado);

/** "Factura C 00002-00000154", "Nota de crédito C 00002-00000012", o "Factura" sola mientras no tiene número. */
export const nombreComprobante = (c) => [c.nombreTipo || (c.notaCredito ? 'Nota de crédito' : 'Factura'), c.letra, c.numeroCompleto]
  .filter(Boolean).join(' ');

/** La factura de un cobro, de la lista de comprobantesDelCobro: la última que no es una nota de crédito. */
export const facturaDelCobro = (comprobantes) => comprobantes.filter((c) => !c.notaCredito).pop() || null;

/** "20-12345678-6" */
export const cuitConGuiones = (cuit) => (cuit && cuit.length === 11 ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}` : cuit || '');

// ---- Aviso de comprobantes con problemas (menú): se pregunta cada minuto mientras algo lo muestra ----

const CADA_MS = 60000;
const SIN_PROBLEMAS = { pendientes: 0, inciertos: 0, rechazados: 0 };
let estado = SIN_PROBLEMAS;
const oyentes = new Set();
let temporizador = null;

export const actualizarAvisoFacturacion = async () => {
  try {
    const nuevo = await obtenerEstadoFacturacion();
    const resumen = { pendientes: nuevo.pendientes, inciertos: nuevo.inciertos, rechazados: nuevo.rechazados };
    if (JSON.stringify(resumen) !== JSON.stringify(estado)) {
      estado = resumen;
      oyentes.forEach((oyente) => oyente());
    }
  } catch {
    // sin conexión con el servidor: queda lo último que se supo
  }
};

const suscribir = (oyente) => {
  oyentes.add(oyente);
  if (!temporizador) {
    actualizarAvisoFacturacion();
    temporizador = setInterval(actualizarAvisoFacturacion, CADA_MS);
  }
  return () => {
    oyentes.delete(oyente);
    if (oyentes.size === 0) {
      clearInterval(temporizador);
      temporizador = null;
    }
  };
};
const ninguno = () => () => {};

/** { pendientes, inciertos, rechazados } de la cola de facturación (con activo en false no pregunta). */
export const useAvisoFacturacion = (activo) =>
  useSyncExternalStore(activo ? suscribir : ninguno, () => (activo ? estado : SIN_PROBLEMAS));
