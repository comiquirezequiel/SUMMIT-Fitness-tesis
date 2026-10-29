package com.summit.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;

import java.math.BigDecimal;

/**
 * Un cobro en recepción, o su presupuesto (el mismo pedido sin el medio de pago). El total lo calcula el backend:
 * precio del plan - descuento + matrícula.
 */
@Builder(toBuilder = true)
public record CobroRequestDTO(
        Long idUsuario,   // en el presupuesto puede faltar: socio nuevo, todavía sin registrar
        Long idPlan,

        // Descuento: uno del catálogo o uno especial con motivo (no los dos). Ninguno = sin descuento
        Long idDescuento,
        DescuentoEspecial descuentoEspecial,

        // Si corresponde matrícula, recepción puede no cobrarla
        boolean bonificarMatricula,

        String metodoPago,
        String comprobante,

        // Transferencia o QR que todavía no se ve acreditado (con el nombre explícito en el JSON, como antes con Lombok)
        @JsonProperty("aVerificar")
        boolean aVerificar,

        // El total que vio recepción: si no coincide con el calculado (cambió un precio), el cobro no se registra
        BigDecimal totalMostrado
) {

    public record DescuentoEspecial(
            BigDecimal monto,
            String motivo
    ) {
    }
}
