// Valores fijos del dominio compartidos entre pantallas.

export const GENEROS = ['Masculino', 'Femenino', 'No binario', 'Prefiero no decirlo'];

export const OBJETIVOS = ['Hipertrofia', 'Pérdida de peso', 'Fuerza', 'Salud general', 'Rendimiento deportivo', 'Rehabilitación'];

// Métodos que recepción puede elegir al cobrar (el débito automático lo registra el sistema solo).
// MERCADO_PAGO se muestra como "QR / billetera": el QR del gimnasio se paga desde cualquier billetera o banco.
export const METODOS_PAGO = [
  { valor: 'EFECTIVO', texto: 'Efectivo' },
  { valor: 'TRANSFERENCIA', texto: 'Transferencia' },
  { valor: 'MERCADO_PAGO', texto: 'QR / billetera' },
  { valor: 'TARJETA_DEBITO', texto: 'Tarjeta de débito' },
  { valor: 'TARJETA_CREDITO', texto: 'Tarjeta de crédito' },
];

const TEXTO_METODO = {
  ...Object.fromEntries(METODOS_PAGO.map(m => [m.valor, m.texto])),
  DEBITO_AUTOMATICO: 'Débito automático',
};

export const textoMetodoPago = (valor) => TEXTO_METODO[valor] || valor;

// Métodos en los que la plata puede no verse acreditada en el momento: pueden quedar "a verificar"
export const METODOS_VERIFICABLES = ['TRANSFERENCIA', 'MERCADO_PAGO'];

export const ESTADOS_PAGO = {
  APROBADO: { texto: 'Aprobado', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PENDIENTE: { texto: 'A verificar', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  RECHAZADO: { texto: 'Rechazado', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export const ESTADOS_USUARIO = {
  ACTIVO: { texto: 'Activo', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  INACTIVO: { texto: 'Inactivo', clase: 'bg-slate-100 text-slate-600 border-slate-200' },
  PENDIENTE: { texto: 'Pendiente', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  SUSPENDIDO: { texto: 'Suspendido', clase: 'bg-orange-50 text-orange-700 border-orange-200' },
  CANCELADO: { texto: 'De baja', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
};
