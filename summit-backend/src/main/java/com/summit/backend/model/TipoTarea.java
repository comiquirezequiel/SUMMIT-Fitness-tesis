package com.summit.backend.model;

/**
 * Por qué hay que contactar a un socio. Las automáticas las genera SeguimientoService; las manuales, recepción.
 */
public enum TipoTarea {
    CUOTA_POR_VENCER,  // la cuota vence en pocos días (y no tiene débito automático)
    CUOTA_VENCIDA,     // venció hace pocos días y no renovó
    APTO_POR_VENCER,   // el apto médico vence pronto
    INACTIVO,          // tiene la cuota al día pero hace días que no viene
    MANUAL             // la cargó alguien del equipo
}
