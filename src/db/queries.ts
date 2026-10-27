import { db } from './index.ts';
import { users, planes, certificadosMedicos, pagos, asistenciasLog } from './schema.ts';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

export async function getDashboardMetricas() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Todos los pagos
    const allPagos = await db.select().from(pagos);
    const allUsers = await db.select().from(users);
    const allAsistencias = await db.select().from(asistenciasLog);

    const ingresosDelMes = allPagos
      .filter((p) => p.estadoPago === 'APROBADO' && new Date(p.fechaPago) >= startOfMonth)
      .reduce((sum, p) => sum + Number(p.montoAbonado), 0);

    const ingresosDeHoy = allPagos
      .filter((p) => p.estadoPago === 'APROBADO' && new Date(p.fechaPago) >= startOfToday)
      .reduce((sum, p) => sum + Number(p.montoAbonado), 0);

    const totalSociosActivos = allUsers.filter((u) => u.estado === 'ACTIVO').length;

    const asistenciasExitosas = allAsistencias.filter(
      (a) =>
        new Date(a.fechaHora) >= startOfMonth &&
        (a.resultado === 'ACCESO_PERMITIDO' || a.resultado === 'ACCESO_FORZADO')
    ).length;

    const retencionRaw = totalSociosActivos === 0 ? 0 : Math.min(100, (asistenciasExitosas / totalSociosActivos) * 100);
    const porcentajeRetencion = Math.round(retencionRaw * 100) / 100;

    const horasPico: Record<string, number> = {
      '7': 4,
      '8': 10,
      '9': 15,
      '10': 9,
      '11': 6,
      '14': 8,
      '17': 19,
      '18': 35,
      '19': 42,
      '20': 28,
      '21': 14,
    };

    const nuevosEsteMes = allUsers.filter((u) => new Date(u.fechaRegistro) >= startOfMonth).length;
    const solicitudesDeBaja = allUsers.filter((u) => u.estado === 'INACTIVO').length;

    return {
      ingresosDelMes,
      totalSociosActivos,
      porcentajeRetencion,
      horasPico,
      ingresosDeHoy,
      nuevosEsteMes,
      solicitudesDeBaja,
    };
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    throw new Error('Database query failed when getting dashboard metrics', { cause: error });
  }
}

export async function getSociosList() {
  try {
    const allUsers = await db.select().from(users).orderBy(desc(users.id));
    const allCerts = await db.select().from(certificadosMedicos).orderBy(desc(certificadosMedicos.id));
    const allPagos = await db.select().from(pagos).orderBy(desc(pagos.fechaPago));

    const hoy = new Date().toISOString().split('T')[0];
    const treintaDiasMs = 30 * 24 * 60 * 60 * 1000;

    return allUsers.map((u) => {
      const userCerts = allCerts.filter((c) => c.usuarioId === u.id);
      const latestCert = userCerts[0];
      const sinApto =
        !latestCert ||
        latestCert.estadoLegal !== 'VIGENTE' ||
        latestCert.fechaVencimiento < hoy;

      const userPagos = allPagos.filter((p) => p.usuarioId === u.id && p.estadoPago === 'APROBADO');
      const latestPago = userPagos[0];
      const sinPago =
        !latestPago ||
        Date.now() - new Date(latestPago.fechaPago).getTime() > treintaDiasMs;

      return {
        id: u.id,
        nombreCompleto: u.nombreCompleto,
        dni: u.dni,
        email: u.email,
        telefono: u.telefono || 'Sin teléfono',
        estado: u.estado,
        fechaRegistro: u.fechaRegistro.toISOString(),
        alertaMedico: sinApto,
        alertaPago: sinPago,
      };
    });
  } catch (error) {
    console.error('Error fetching socios list:', error);
    throw new Error('Database query failed when getting socios list', { cause: error });
  }
}

export async function createSocio(data: { nombre: string; apellido: string; dni: string; email: string; telefono?: string }) {
  try {
    const existing = await db.select().from(users).where(eq(users.dni, data.dni));
    if (existing.length > 0) {
      throw new Error('El DNI ya se encuentra registrado en el sistema.');
    }

    const inserted = await db
      .insert(users)
      .values({
        dni: data.dni,
        nombreCompleto: `${data.nombre} ${data.apellido}`,
        email: data.email,
        telefono: data.telefono || '',
        rol: 'SOCIO',
        estado: 'PENDIENTE',
      })
      .returning();

    return inserted[0];
  } catch (error: any) {
    console.error('Error creating socio:', error);
    throw error;
  }
}

export async function updateSocio(id: number, data: { nombreCompleto?: string; email?: string; telefono?: string; estado?: string }) {
  try {
    const updateValues: Record<string, any> = {};
    if (data.nombreCompleto) updateValues.nombreCompleto = data.nombreCompleto;
    if (data.email) updateValues.email = data.email;
    if (data.telefono !== undefined) updateValues.telefono = data.telefono;
    if (data.estado) updateValues.estado = data.estado.toUpperCase();

    const updated = await db
      .update(users)
      .set(updateValues)
      .where(eq(users.id, id))
      .returning();

    if (updated.length === 0) {
      throw new Error('Socio no encontrado en la base de datos.');
    }
    return updated[0];
  } catch (error: any) {
    console.error('Error updating socio:', error);
    throw error;
  }
}

export async function deleteSocio(id: number) {
  try {
    const updated = await db
      .update(users)
      .set({ estado: 'INACTIVO' })
      .where(eq(users.id, id))
      .returning();

    if (updated.length === 0) {
      throw new Error('Socio no encontrado en la base de datos.');
    }
    return updated[0];
  } catch (error: any) {
    console.error('Error deleting socio:', error);
    throw error;
  }
}

export async function intentarAcceso(dni: string) {
  try {
    const userResult = await db.select().from(users).where(eq(users.dni, dni));
    if (userResult.length === 0) {
      return { status: 404, message: 'Usuario no encontrado' };
    }
    const socio = userResult[0];

    const hoy = new Date().toISOString().split('T')[0];
    const certs = await db
      .select()
      .from(certificadosMedicos)
      .where(eq(certificadosMedicos.usuarioId, socio.id))
      .orderBy(desc(certificadosMedicos.id));
    const cert = certs[0];

    // 1. Barrera Médica
    if (!cert || cert.estadoLegal !== 'VIGENTE' || cert.fechaVencimiento < hoy) {
      await db.insert(asistenciasLog).values({
        usuarioId: socio.id,
        tipoEvento: 'ENTRADA',
        resultado: 'BLOQUEO_MEDICO',
      });
      return { status: 403, message: 'BLOQUEO_MEDICO - Certificado Médico Vencido o Inválido' };
    }

    // 2. Barrera Financiera
    const pagosList = await db
      .select()
      .from(pagos)
      .where(and(eq(pagos.usuarioId, socio.id), eq(pagos.estadoPago, 'APROBADO')))
      .orderBy(desc(pagos.fechaPago));
    const pago = pagosList[0];
    const treintaDiasMs = 30 * 24 * 60 * 60 * 1000;

    if (!pago || Date.now() - new Date(pago.fechaPago).getTime() > treintaDiasMs) {
      await db.insert(asistenciasLog).values({
        usuarioId: socio.id,
        tipoEvento: 'ENTRADA',
        resultado: 'BLOQUEO_PAGO',
      });
      return { status: 403, message: 'BLOQUEO_PAGO - Cuota impaga o pago demorado' };
    }

    // 3. Acceso Permitido
    await db.insert(asistenciasLog).values({
      usuarioId: socio.id,
      tipoEvento: 'ENTRADA',
      resultado: 'ACCESO_PERMITIDO',
    });

    return { status: 200, message: 'ACCESO_PERMITIDO' };
  } catch (error) {
    console.error('Error in intentarAcceso:', error);
    throw new Error('Database error during access attempt', { cause: error });
  }
}

export async function forzarAcceso(dni: string, auditor: string) {
  try {
    const userResult = await db.select().from(users).where(eq(users.dni, dni));
    if (userResult.length === 0) {
      throw new Error('Socio no encontrado');
    }
    const socio = userResult[0];

    await db.insert(asistenciasLog).values({
      usuarioId: socio.id,
      tipoEvento: 'ENTRADA',
      resultado: 'ACCESO_FORZADO',
    });

    return { mensaje: `Ingreso FORZADO registrado con éxito. Autorizado por: ${auditor}` };
  } catch (error: any) {
    console.error('Error in forzarAcceso:', error);
    throw error;
  }
}

export async function simularCertificado(dni: string) {
  try {
    const userResult = await db.select().from(users).where(eq(users.dni, dni));
    if (userResult.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    const socio = userResult[0];

    const hoy = new Date().toISOString().split('T')[0];
    const vencimiento = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await db.insert(certificadosMedicos).values({
      usuarioId: socio.id,
      archivoUrl: `/storage/mock-certificado-${dni}.pdf`,
      fechaEmision: hoy,
      fechaVencimiento: vencimiento,
      estadoLegal: 'VIGENTE',
    });

    if (socio.estado === 'PENDIENTE') {
      await db.update(users).set({ estado: 'ACTIVO' }).where(eq(users.id, socio.id));
    }

    return `Certificado VIGENTE hasta ${vencimiento}`;
  } catch (error: any) {
    console.error('Error in simularCertificado:', error);
    throw error;
  }
}

export async function revisarCertificado(id: number, aprobado: boolean) {
  try {
    const certResult = await db.select().from(certificadosMedicos).where(eq(certificadosMedicos.id, id));
    if (certResult.length === 0) {
      throw new Error('Certificado no encontrado.');
    }
    const cert = certResult[0];

    if (aprobado) {
      const vencimiento = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      await db
        .update(certificadosMedicos)
        .set({
          estadoLegal: 'VIGENTE',
          fechaVencimiento: vencimiento,
        })
        .where(eq(certificadosMedicos.id, id));

      await db
        .update(users)
        .set({ estado: 'ACTIVO' })
        .where(eq(users.id, cert.usuarioId));

      return 'Certificado Aprobado y socio activado.';
    } else {
      await db
        .update(certificadosMedicos)
        .set({ estadoLegal: 'RECHAZADO' })
        .where(eq(certificadosMedicos.id, id));

      return 'Certificado Rechazado.';
    }
  } catch (error: any) {
    console.error('Error in revisarCertificado:', error);
    throw error;
  }
}

export async function procesarPago(dniSocio: string, planId: number | string) {
  try {
    const userResult = await db.select().from(users).where(eq(users.dni, dniSocio));
    if (userResult.length === 0) {
      throw new Error('Socio no encontrado');
    }
    const socio = userResult[0];

    const planList = await db.select().from(planes).where(eq(planes.id, Number(planId)));
    const selectedPlan = planList.length > 0 ? planList[0] : { id: 3, precioBase: 32000 };

    const nuevoPago = await db
      .insert(pagos)
      .values({
        usuarioId: socio.id,
        planId: selectedPlan.id,
        montoAbonado: selectedPlan.precioBase,
        metodoPago: 'MERCADO_PAGO',
        estadoPago: 'APROBADO',
        mpPaymentId: `MP-${Date.now()}`,
      })
      .returning();

    if (socio.estado === 'PENDIENTE') {
      await db.update(users).set({ estado: 'ACTIVO' }).where(eq(users.id, socio.id));
    }

    return {
      id_pago_local: nuevoPago[0].id,
      estado: 'APROBADO',
      mensaje: 'Transacción procesada correctamente',
    };
  } catch (error: any) {
    console.error('Error in procesarPago:', error);
    throw error;
  }
}
