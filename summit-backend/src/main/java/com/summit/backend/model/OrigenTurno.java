package com.summit.backend.model;

/**
 * Cómo empezó un turno del personal.
 */
public enum OrigenTurno {
    RECEPCION, // lo abrió su paso por el control de acceso
    MANUAL     // lo cargó el admin (la persona se olvidó de marcar la entrada)
}
