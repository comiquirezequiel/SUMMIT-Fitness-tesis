// Seguimiento de socios: inactividad, tareas de contacto y los mensajes de WhatsApp de cada una.
import { useSyncExternalStore } from 'react';
import { pedirJson, conJson } from './api';
import { formatFecha, diasHasta } from '../utils/formato';

export const obtenerInactividad = (minDias = 7) =>
  pedirJson(`/seguimiento/inactividad?minDias=${minDias}`, {}, 'No se pudo calcular la inactividad');
export const listarTareas = (vista = 'pendientes') =>
  pedirJson(`/seguimiento/tareas?vista=${vista}`, {}, 'No se pudieron leer las tareas');
export const generarTareas = () => pedirJson('/seguimiento/tareas/generar', { method: 'POST' }, 'No se pudieron actualizar las tareas');
export const crearTarea = (tarea) => pedirJson('/seguimiento/tareas', conJson('POST', tarea), 'No se pudo crear la tarea');
export const resolverTarea = (idTarea, resolucion) =>
  pedirJson(`/seguimiento/tareas/${idTarea}/resolver`, conJson('POST', resolucion), 'No se pudo guardar la tarea');
export const registrarContacto = (contacto) =>
  pedirJson('/seguimiento/contactos', conJson('POST', contacto), 'No se pudo registrar el contacto');

export const TIPOS_TAREA = {
  CUOTA_POR_VENCER: { texto: 'Cuota por vencer', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  CUOTA_VENCIDA: { texto: 'Cuota vencida', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
  APTO_POR_VENCER: { texto: 'Apto por vencer', clase: 'bg-violet-50 text-violet-700 border-violet-200' },
  INACTIVO: { texto: 'No viene', clase: 'bg-orange-50 text-orange-700 border-orange-200' },
  MANUAL: { texto: 'Tarea', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export const CANALES = [
  { valor: 'WHATSAPP', texto: 'WhatsApp' },
  { valor: 'LLAMADA', texto: 'Llamada' },
  { valor: 'PRESENCIAL', texto: 'En persona' },
  { valor: 'EMAIL', texto: 'Email' },
  { valor: 'OTRO', texto: 'Otro' },
];
export const textoCanal = (valor) => CANALES.find(c => c.valor === valor)?.texto || valor;

const nombrePila = (nombre) => (nombre || '').trim().split(' ')[0];
const firma = (gimnasio) => (gimnasio ? ` – ${gimnasio}` : '');

/** Mensaje de WhatsApp ya armado para una tarea (gimnasio: el nombre, para firmar). */
export const mensajeTarea = (tarea, gimnasio) => {
  const hola = `¡Hola, ${nombrePila(tarea.nombreSocio)}!`;
  const fecha = tarea.fechaReferencia ? formatFecha(tarea.fechaReferencia) : '';
  switch (tarea.tipo) {
    case 'CUOTA_POR_VENCER':
      return `${hola} Te recordamos que tu cuota vence el ${fecha}. Podés renovarla en recepción. ¡Te esperamos!${firma(gimnasio)}`;
    case 'CUOTA_VENCIDA':
      return `${hola} Tu cuota venció el ${fecha}. Cuando quieras, renovala en recepción y seguimos entrenando.${firma(gimnasio)}`;
    case 'APTO_POR_VENCER':
      return `${hola} Tu apto médico vence el ${fecha}. Acordate de traer uno nuevo a recepción para seguir entrenando.${firma(gimnasio)}`;
    case 'INACTIVO':
      return mensajeInactivo(tarea.nombreSocio, tarea.fechaReferencia ? -diasHasta(tarea.fechaReferencia) : null, gimnasio);
    default:
      return `${hola}${firma(gimnasio)}`;
  }
};

/** Mensaje para un socio que hace días que no viene (dias null: nunca vino). */
export const mensajeInactivo = (nombre, dias, gimnasio) => (dias === null
  ? `¡Hola, ${nombrePila(nombre)}! Todavía no te vimos por el gimnasio. ¿Te ayudamos a arrancar? Te esperamos cuando quieras.${firma(gimnasio)}`
  : `¡Hola, ${nombrePila(nombre)}! Hace ${dias} días que no te vemos por el gimnasio. ¿Está todo bien? Te esperamos cuando quieras.${firma(gimnasio)}`);

// ---- Aviso de tareas pendientes (campanita): se pregunta cada minuto mientras algo lo muestra ----

const CADA_MS = 60000;
let cantidades = { pendientes: 0, atrasadas: 0 };
const oyentes = new Set();
let temporizador = null;

export const actualizarTareasPendientes = async () => {
  try {
    const nuevas = await pedirJson('/seguimiento/tareas/cantidad');
    if (nuevas.pendientes !== cantidades.pendientes || nuevas.atrasadas !== cantidades.atrasadas) {
      cantidades = nuevas;
      oyentes.forEach((oyente) => oyente());
    }
  } catch {
    // sin conexión con el servidor: queda lo último que se supo
  }
};

const suscribir = (oyente) => {
  oyentes.add(oyente);
  if (!temporizador) {
    actualizarTareasPendientes();
    temporizador = setInterval(actualizarTareasPendientes, CADA_MS);
  }
  return () => {
    oyentes.delete(oyente);
    if (oyentes.size === 0) {
      clearInterval(temporizador);
      temporizador = null;
    }
  };
};
const ninguna = () => () => {};
const sinTareas = { pendientes: 0, atrasadas: 0 };

/** { pendientes, atrasadas } (solo para quien hace el seguimiento: con activo en false no pregunta). */
export const useTareasPendientes = (activo) =>
  useSyncExternalStore(activo ? suscribir : ninguna, () => (activo ? cantidades : sinTareas));
