import { pedirJson, conJson } from './api';

// Caja de recepción: el turno abierto, su cierre (arqueo) y los gastos.

export const obtenerTurno = () => pedirJson('/caja/turno', {}, 'No se pudo leer el turno de caja');
export const cerrarCaja = (cierre) => pedirJson('/caja/cierres', conJson('POST', cierre), 'No se pudo cerrar la caja');
export const listarCierres = (pagina, tamanio = 10) =>
  pedirJson(`/caja/cierres?page=${pagina}&size=${tamanio}&sort=hasta,desc`, {}, 'No se pudieron leer los cierres de caja');

export const listarGastos = (pagina, tamanio = 15) =>
  pedirJson(`/caja/gastos?page=${pagina}&size=${tamanio}&sort=fecha,desc`, {}, 'No se pudieron leer los gastos');
export const registrarGasto = (gasto) => pedirJson('/caja/gastos', conJson('POST', gasto), 'No se pudo registrar el gasto');
export const anularGasto = (idGasto, motivo) =>
  pedirJson(`/caja/gastos/${idGasto}/anular`, conJson('POST', { motivo }), 'No se pudo anular el gasto');

export const CATEGORIAS_GASTO = [
  { valor: 'ALQUILER', texto: 'Alquiler' },
  { valor: 'SERVICIOS', texto: 'Servicios (luz, agua, gas, internet)' },
  { valor: 'SUELDOS', texto: 'Sueldos y honorarios' },
  { valor: 'LIMPIEZA', texto: 'Limpieza' },
  { valor: 'MANTENIMIENTO', texto: 'Mantenimiento y arreglos' },
  { valor: 'EQUIPAMIENTO', texto: 'Equipamiento' },
  { valor: 'INSUMOS', texto: 'Insumos y librería' },
  { valor: 'IMPUESTOS', texto: 'Impuestos y tasas' },
  { valor: 'OTROS', texto: 'Otros' },
];
export const textoCategoriaGasto = (valor) => CATEGORIAS_GASTO.find(c => c.valor === valor)?.texto.replace(/ \(.*\)$/, '') || valor;
