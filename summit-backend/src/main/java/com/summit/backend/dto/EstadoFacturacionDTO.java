package com.summit.backend.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Cómo está la facturación electrónica: si está prendida, el ambiente, el certificado, los datos fiscales y la cola.
 * advertencias: cosas que no frenan la facturación pero conviene mirar (el certificado vence pronto, es de otra CUIT).
 */
public record EstadoFacturacionDTO(
        boolean habilitada,
        String ambiente,
        boolean deVerdad,
        boolean certificadoCargado,
        String certificadoError,
        String certificadoSujeto,
        String certificadoCuit,
        LocalDate certificadoVence,
        Long certificadoDiasParaVencer,
        boolean certificadoDeMentira,
        boolean datosCompletos,
        List<String> faltantes,
        long pendientes,
        long inciertos,
        long rechazados,
        String ultimoError,
        List<String> advertencias
) {
    public static EstadoFacturacionDTO apagada() {
        return new EstadoFacturacionDTO(false, null, false, false, null, null, null, null, null, false, false,
                List.of(), 0, 0, 0, null, List.of());
    }
}
