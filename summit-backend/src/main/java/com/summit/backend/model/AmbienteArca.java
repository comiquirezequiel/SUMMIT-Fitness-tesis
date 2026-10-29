package com.summit.backend.model;

/**
 * Contra qué ARCA se factura (summit.arca.ambiente). Cada comprobante guarda el suyo: los de prueba nunca se mezclan
 * con los reales.
 */
public enum AmbienteArca {
    SIMULADOR,      // un ARCA de mentira dentro del backend, para probar y mostrar sin certificado
    HOMOLOGACION,   // el ambiente de pruebas de ARCA (certificado de homologación, sin validez fiscal)
    PRODUCCION;     // facturas reales

    public boolean deVerdad() {
        return this == PRODUCCION;
    }
}
