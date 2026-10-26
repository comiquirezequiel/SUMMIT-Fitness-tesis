package com.summit.backend.model;

/**
 * Qué se le hizo a un turno del personal al corregirlo.
 */
public enum AccionCorreccion {
    ALTA,      // se cargó el turno entero (se olvidó de marcar la entrada)
    CAMBIO,    // se cambió la hora de entrada o de salida, o se cargó la salida que faltaba
    ANULACION  // el turno deja de contar (por ejemplo, un paso por recepción que no era un turno)
}
