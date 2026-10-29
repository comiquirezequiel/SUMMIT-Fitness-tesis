package com.summit.backend.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Un gasto de la caja para el listado.
 */
@Builder
public record GastoDTO(
        Long idGasto,
        LocalDateTime fecha,
        BigDecimal monto,
        String categoria,
        String descripcion,
        String metodoPago,
        boolean fueraDeCaja, // en efectivo, pero no salió de la caja: no cuenta en el arqueo
        String comprobante,
        String registradoPor,
        boolean anulado,
        String anuladoPor,
        LocalDateTime fechaAnulacion,
        String motivoAnulacion,
        boolean anulable // del turno abierto y sin anular: todavía se puede anular
) {
}
