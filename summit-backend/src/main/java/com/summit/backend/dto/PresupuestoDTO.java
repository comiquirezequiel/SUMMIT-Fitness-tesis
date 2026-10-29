package com.summit.backend.dto;

import lombok.Builder;

import java.math.BigDecimal;

/**
 * Detalle de un cobro antes de confirmarlo: precio del plan, descuento, matrícula y total.
 */
@Builder
public record PresupuestoDTO(
        Long idPlan,
        String plan,
        BigDecimal precioLista,

        Long idDescuento,          // el del catálogo que se aplicó (null si no hay o es especial)
        String descuentoNombre,    // nombre del descuento, o "Especial: <motivo>"; null = sin descuento
        BigDecimal descuentoMonto, // 0 si no hay descuento

        boolean matriculaCorresponde,
        String matriculaMotivo,    // "Inscripción" o "Reinscripción: ..."; null si no corresponde
        BigDecimal matriculaMonto, // la matrícula configurada (aunque se bonifique)
        boolean matriculaBonificada,

        BigDecimal total
) {
}
