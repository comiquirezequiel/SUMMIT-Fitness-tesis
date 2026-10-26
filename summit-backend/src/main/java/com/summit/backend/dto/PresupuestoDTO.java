package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Detalle de un cobro antes de confirmarlo: precio del plan, descuento, matrícula y total.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresupuestoDTO {
    private Long idPlan;
    private String plan;
    private BigDecimal precioLista;

    private Long idDescuento;          // el del catálogo que se aplicó (null si no hay o es especial)
    private String descuentoNombre;    // nombre del descuento, o "Especial: <motivo>"; null = sin descuento
    private BigDecimal descuentoMonto; // 0 si no hay descuento

    private boolean matriculaCorresponde;
    private String matriculaMotivo;    // "Inscripción" o "Reinscripción: ..."; null si no corresponde
    private BigDecimal matriculaMonto; // la matrícula configurada (aunque se bonifique)
    private boolean matriculaBonificada;

    private BigDecimal total;
}
