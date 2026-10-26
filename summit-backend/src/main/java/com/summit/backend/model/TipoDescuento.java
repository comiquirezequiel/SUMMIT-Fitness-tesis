package com.summit.backend.model;

/**
 * Cómo se calcula un descuento sobre el precio del plan.
 */
public enum TipoDescuento {
    PORCENTAJE,  // valor = porcentaje del precio del plan (ej. 10 = 10 %)
    MONTO_FIJO   // valor = pesos que se le restan al precio del plan
}
