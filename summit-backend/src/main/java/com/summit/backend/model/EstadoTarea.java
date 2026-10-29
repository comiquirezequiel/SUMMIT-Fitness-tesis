package com.summit.backend.model;

/**
 * Estado de una tarea de seguimiento.
 */
public enum EstadoTarea {
    PENDIENTE,
    HECHA,       // alguien del equipo contactó al socio
    DESCARTADA,  // no hacía falta (o el socio se dio de baja)
    RESUELTA     // la situación se resolvió sola: renovó, volvió al gimnasio o trajo el apto
}
