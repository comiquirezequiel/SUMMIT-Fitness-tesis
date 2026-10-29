package com.summit.backend.dto;

import lombok.Builder;

import java.math.BigDecimal;

/**
 * Un descuento del catálogo, con cuántos socios lo tienen como habitual.
 */
@Builder
public record DescuentoDTO(
        Long idDescuento,
        String nombre,
        String tipo,        // PORCENTAJE o MONTO_FIJO
        BigDecimal valor,
        boolean activo,
        long socios
) {
}
