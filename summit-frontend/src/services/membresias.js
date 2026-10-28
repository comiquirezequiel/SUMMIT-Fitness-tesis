import { useEffect, useState } from 'react';
import { pedirJson as pedir, conJson as json } from './api';
import { diasHasta, formatMoneda } from '../utils/formato';

// Membresías flexibles: catálogo de descuentos, reglas (matrícula y congelamientos), detalle de un cobro antes de
// confirmarlo y congelamientos de la membresía de un socio.

export const obtenerReglas = () => pedir('/configuracion/membresias', {}, 'No se pudieron leer las reglas');
export const guardarReglas = (reglas) => pedir('/configuracion/membresias', json('PUT', reglas), 'No se pudieron guardar las reglas');

export const listarDescuentos = (soloActivos = false) =>
  pedir(`/configuracion/descuentos${soloActivos ? '?activos=true' : ''}`, {}, 'No se pudieron leer los descuentos');
export const crearDescuento = (descuento) => pedir('/configuracion/descuentos', json('POST', descuento), 'No se pudo crear el descuento');
export const actualizarDescuento = (id, descuento) =>
  pedir(`/configuracion/descuentos/${id}`, json('PUT', descuento), 'No se pudo guardar el descuento');
export const eliminarDescuento = (id) => pedir(`/configuracion/descuentos/${id}`, { method: 'DELETE' }, 'No se pudo borrar el descuento');

// Mismo pedido que el cobro, sin medio de pago (sin idUsuario: socio nuevo)
export const pedirPresupuesto = (pedido) => pedir('/pagos/presupuesto', json('POST', pedido), 'No se pudo calcular el total');
export const registrarCobro = (pedido) => pedir('/pagos', json('POST', pedido), 'No se pudo registrar el cobro');

export const listarCongelamientos = (idSocio) =>
  pedir(`/socios/${idSocio}/congelamientos`, {}, 'No se pudieron leer los congelamientos');
export const congelarMembresia = (idSocio, pedido) =>
  pedir(`/socios/${idSocio}/congelamientos`, json('POST', pedido), 'No se pudo congelar la membresía');
export const terminarCongelamiento = (idSocio, idCongelamiento) =>
  pedir(`/socios/${idSocio}/congelamientos/${idCongelamiento}/terminar`, { method: 'POST' }, 'No se pudo terminar el congelamiento');

// "10 %" o "$ 2.500"
export const textoValorDescuento = (d) => (d.tipo === 'PORCENTAJE' ? `${Number(d.valor).toLocaleString('es-AR')} %` : formatMoneda(d.valor));

// Días antes del vencimiento en que ya se ofrece cobrar la cuota siguiente (lista de socios y control de acceso)
export const DIAS_PARA_OFRECER_COBRO = 7;

/**
 * Qué cobro se le ofrece a un socio de la lista: 'COBRAR' (sin membresía o vencida, aunque esté en los días de gracia),
 * 'RENOVAR' (vence dentro de DIAS_PARA_OFRECER_COBRO días) o null: ya está paga, tiene un cobro a verificar (pagó por
 * transferencia o QR y falta que un admin lo confirme), está congelada o el socio está de baja.
 */
export const cobroParaOfrecer = (socio) => {
  if (socio.estado === 'CANCELADO' || socio.cobroAVerificar || socio.congeladaHasta) return null;
  const dias = diasHasta(socio.vencimientoMembresia);
  if (dias === null || dias < 0) return 'COBRAR';
  return dias <= DIAS_PARA_OFRECER_COBRO ? 'RENOVAR' : null;
};

export const MOTIVOS_CONGELAMIENTO = [
  { valor: 'VACACIONES', texto: 'Vacaciones' },
  { valor: 'SALUD', texto: 'Salud o lesión' },
  { valor: 'OTRO', texto: 'Otro' },
];
export const textoMotivoCongelamiento = (valor) => MOTIVOS_CONGELAMIENTO.find(m => m.valor === valor)?.texto || valor;

export const ESTADOS_CONGELAMIENTO = {
  PROGRAMADO: { texto: 'Programado', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  EN_CURSO: { texto: 'En curso', clase: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  TERMINADO: { texto: 'Terminado', clase: 'bg-slate-100 text-slate-600 border-slate-200' },
  ANULADO: { texto: 'Anulado', clase: 'bg-slate-50 text-slate-400 border-slate-200 line-through' },
};

/**
 * Detalle de un cobro que se recalcula cuando cambia el pedido (plan, descuento, matrícula). Espera un momento antes
 * de pedirlo para no mandar un pedido por cada tecla del descuento especial. pedido null = todavía no hay plan.
 * Devuelve { presupuesto, calculando, error, recalcular } (recalcular: por ejemplo, si al cobrar el total cambió).
 */
export const usePresupuesto = (pedido) => {
  const [estado, setEstado] = useState({ presupuesto: null, calculando: false, error: '' });
  const [vuelta, setVuelta] = useState(0);
  const clave = pedido ? JSON.stringify(pedido) : '';

  useEffect(() => {
    if (!clave) {
      setEstado({ presupuesto: null, calculando: false, error: '' });
      return undefined;
    }
    let vigente = true;
    setEstado(prev => ({ ...prev, calculando: true }));
    const demora = setTimeout(() => {
      pedirPresupuesto(JSON.parse(clave))
        .then((presupuesto) => vigente && setEstado({ presupuesto, calculando: false, error: '' }))
        .catch((err) => vigente && setEstado({ presupuesto: null, calculando: false, error: err.message }));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(demora);
    };
  }, [clave, vuelta]);

  return { ...estado, recalcular: () => setVuelta(v => v + 1) };
};
