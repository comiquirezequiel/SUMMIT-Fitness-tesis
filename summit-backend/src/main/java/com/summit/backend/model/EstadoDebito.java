package com.summit.backend.model;

/**
 * Estado de una adhesión al débito automático (refleja el de la suscripción en Mercado Pago).
 */
public enum EstadoDebito {
    PENDIENTE_AUTORIZACION, // creada: falta que el socio la autorice en Mercado Pago
    ACTIVO,                 // autorizada: Mercado Pago cobra solo cada mes
    PAUSADO,                // pausada desde Mercado Pago: no se cobra hasta que se reanude
    CANCELADO               // dada de baja (por el socio, por recepción o desde Mercado Pago)
}
