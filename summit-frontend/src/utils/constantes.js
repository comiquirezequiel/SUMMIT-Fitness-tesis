// Valores fijos del dominio compartidos entre pantallas.

export const GENEROS = ['Masculino', 'Femenino', 'No binario', 'Prefiero no decirlo'];

export const OBJETIVOS = ['Hipertrofia', 'Pérdida de peso', 'Fuerza', 'Salud general', 'Rendimiento deportivo', 'Rehabilitación'];

// Días de la semana como los manda el backend (enum DiaSemana), de lunes a domingo
export const DIAS_SEMANA = [
  { enum: 'LUNES', nombre: 'Lunes' }, { enum: 'MARTES', nombre: 'Martes' }, { enum: 'MIERCOLES', nombre: 'Miércoles' },
  { enum: 'JUEVES', nombre: 'Jueves' }, { enum: 'VIERNES', nombre: 'Viernes' }, { enum: 'SABADO', nombre: 'Sábado' },
  { enum: 'DOMINGO', nombre: 'Domingo' },
];

// Lo que dice el QR impreso de ingreso, antes del código del gimnasio (lo imprime Reglas de acceso y lo lee la
// app del socio). Sin la dirección de la web, así el QR impreso sigue sirviendo aunque cambie el dominio.
export const PREFIJO_QR_INGRESO = 'SUMMIT-INGRESO:';

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

// Débito automático mensual (Mercado Pago Suscripciones)
export const ESTADOS_DEBITO = {
  PENDIENTE_AUTORIZACION: { texto: 'Esperando autorización', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACTIVO: { texto: 'Activo', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PAUSADO: { texto: 'Pausado', clase: 'bg-slate-100 text-slate-600 border-slate-200' },
  CANCELADO: { texto: 'De baja', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
};

// Medio con el que el socio autorizó el débito (código que informa Mercado Pago)
const MEDIOS_MP = {
  account_money: 'Dinero en cuenta de Mercado Pago',
  visa: 'Visa crédito', debvisa: 'Visa débito',
  master: 'Mastercard crédito', debmaster: 'Mastercard débito', maestro: 'Maestro',
  amex: 'American Express', naranja: 'Naranja', cabal: 'Cabal crédito', debcabal: 'Cabal débito',
  cencosud: 'Cencosud', argencard: 'Argencard',
};

export const textoMedioPago = (codigo) => (codigo ? MEDIOS_MP[codigo] || codigo : 'Se elige al autorizar');

// Mercado Pago cobra cada N meses: solo sirven los planes de 30 días o múltiplos
export const planAptoDebito = (plan) => plan.activo && plan.duracionDias > 0 && plan.duracionDias % 30 === 0;

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
