package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Un descuento del catálogo, con cuántos socios lo tienen como habitual.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DescuentoDTO {
    private Long idDescuento;
    private String nombre;
    private String tipo;        // PORCENTAJE o MONTO_FIJO
    private BigDecimal valor;
    private boolean activo;
    private long socios;
}
