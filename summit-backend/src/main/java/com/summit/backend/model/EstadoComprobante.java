package com.summit.backend.model;

/**
 * En qué anda un comprobante fiscal (ver FacturacionService).
 */
public enum EstadoComprobante {
    PENDIENTE,      // espera su turno para ir a ARCA (o un reintento)
    ENVIANDO,       // tiene número y se le está pidiendo el CAE a ARCA
    INCIERTO,       // se cortó la conexión después de enviarlo: se le pregunta a ARCA si lo autorizó antes de seguir
    AUTORIZADO,     // tiene CAE: es una factura válida (en producción)
    RECHAZADO       // ARCA dijo que no: hay que corregir el motivo y reintentarlo
}
