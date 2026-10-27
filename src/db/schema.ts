import { pgTable, serial, text, timestamp, integer, doublePrecision } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Tabla de usuarios / socios
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(), // Firebase Auth UID opcional
  dni: text('dni').notNull().unique(),
  nombreCompleto: text('nombre_completo').notNull(),
  email: text('email').notNull(),
  telefono: text('telefono'),
  rol: text('rol').default('SOCIO').notNull(), // 'SOCIO' | 'ADMIN'
  estado: text('estado').default('PENDIENTE').notNull(), // 'ACTIVO' | 'INACTIVO' | 'PENDIENTE'
  fechaRegistro: timestamp('fecha_registro').defaultNow().notNull(),
});

// Planes de membresía
export const planes = pgTable('planes', {
  id: serial('id').primaryKey(),
  nombrePlan: text('nombre_plan').notNull(),
  precioBase: doublePrecision('precio_base').notNull(),
});

// Certificados médicos
export const certificadosMedicos = pgTable('certificados_medicos', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id')
    .references(() => users.id)
    .notNull(),
  archivoUrl: text('archivo_url'),
  fechaEmision: text('fecha_emision').notNull(), // YYYY-MM-DD
  fechaVencimiento: text('fecha_vencimiento').notNull(), // YYYY-MM-DD
  estadoLegal: text('estado_legal').default('VIGENTE').notNull(), // 'VIGENTE' | 'RECHAZADO'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Pagos y cuotas
export const pagos = pgTable('pagos', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id')
    .references(() => users.id)
    .notNull(),
  planId: integer('plan_id')
    .references(() => planes.id)
    .notNull(),
  montoAbonado: doublePrecision('monto_abonado').notNull(),
  fechaPago: timestamp('fecha_pago').defaultNow().notNull(),
  metodoPago: text('metodo_pago').default('MERCADO_PAGO').notNull(), // 'MERCADO_PAGO' | 'EFECTIVO' | 'TRANSFERENCIA'
  estadoPago: text('estado_pago').default('APROBADO').notNull(), // 'APROBADO' | 'PENDIENTE' | 'RECHAZADO'
  mpPaymentId: text('mp_payment_id'),
  aprobadoPor: text('aprobado_por'),
});

// Logs de molinete y accesos
export const asistenciasLog = pgTable('asistencias_log', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id')
    .references(() => users.id)
    .notNull(),
  fechaHora: timestamp('fecha_hora').defaultNow().notNull(),
  tipoEvento: text('tipo_evento').default('ENTRADA').notNull(),
  resultado: text('resultado').notNull(), // 'ACCESO_PERMITIDO' | 'BLOQUEO_MEDICO' | 'BLOQUEO_PAGO' | 'ACCESO_FORZADO' | 'ACCESO_DENEGADO'
});

// Relaciones
export const usersRelations = relations(users, ({ many }) => ({
  certificados: many(certificadosMedicos),
  pagos: many(pagos),
  asistencias: many(asistenciasLog),
}));

export const certificadosRelations = relations(certificadosMedicos, ({ one }) => ({
  usuario: one(users, {
    fields: [certificadosMedicos.usuarioId],
    references: [users.id],
  }),
}));

export const pagosRelations = relations(pagos, ({ one }) => ({
  usuario: one(users, {
    fields: [pagos.usuarioId],
    references: [users.id],
  }),
  plan: one(planes, {
    fields: [pagos.planId],
    references: [planes.id],
  }),
}));

export const asistenciasRelations = relations(asistenciasLog, ({ one }) => ({
  usuario: one(users, {
    fields: [asistenciasLog.usuarioId],
    references: [users.id],
  }),
}));
