// Valores fijos del dominio compartidos entre pantallas.

export const GENEROS = ['Masculino', 'Femenino', 'No binario', 'Prefiero no decirlo'];

export const OBJETIVOS = ['Hipertrofia', 'Pérdida de peso', 'Fuerza', 'Salud general', 'Rendimiento deportivo', 'Rehabilitación'];

export const METODOS_PAGO = [
  { valor: 'EFECTIVO', texto: 'Efectivo' },
  { valor: 'TRANSFERENCIA', texto: 'Transferencia' },
  { valor: 'MERCADO_PAGO', texto: 'Mercado Pago' },
  { valor: 'TARJETA_DEBITO', texto: 'Tarjeta de débito' },
  { valor: 'TARJETA_CREDITO', texto: 'Tarjeta de crédito' },
];

export const textoMetodoPago = (valor) => METODOS_PAGO.find(m => m.valor === valor)?.texto || valor;

export const ESTADOS_USUARIO = {
  ACTIVO: { texto: 'Activo', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  INACTIVO: { texto: 'Inactivo', clase: 'bg-slate-100 text-slate-600 border-slate-200' },
  PENDIENTE: { texto: 'Pendiente', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  SUSPENDIDO: { texto: 'Suspendido', clase: 'bg-orange-50 text-orange-700 border-orange-200' },
  CANCELADO: { texto: 'De baja', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
};
