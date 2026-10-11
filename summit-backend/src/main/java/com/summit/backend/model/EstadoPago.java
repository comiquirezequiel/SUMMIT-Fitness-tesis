package com.summit.backend.model;

/**
 * Estado de un cobro. Solo un pago APROBADO extiende la membresía y suma en la caja.
 * PENDIENTE: transferencia o QR que recepción no pudo ver acreditado en el momento ("a verificar");
 * el admin lo confirma (APROBADO) o lo rechaza (RECHAZADO) después.
 */
public enum EstadoPago {
    PENDIENTE,
    APROBADO,
    RECHAZADO
}
