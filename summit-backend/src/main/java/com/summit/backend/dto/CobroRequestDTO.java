package com.summit.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Un cobro en recepción, o su presupuesto (el mismo pedido sin el medio de pago). El total lo calcula el backend:
 * precio del plan - descuento + matrícula.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CobroRequestDTO {

    private Long idUsuario;   // en el presupuesto puede faltar: socio nuevo, todavía sin registrar
    private Long idPlan;

    // Descuento: uno del catálogo o uno especial con motivo (no los dos). Ninguno = sin descuento
    private Long idDescuento;
    private DescuentoEspecial descuentoEspecial;

    // Si corresponde matrícula, recepción puede no cobrarla
    private boolean bonificarMatricula;

    private String metodoPago;
    private String comprobante;

    // Transferencia o QR que todavía no se ve acreditado (con el nombre explícito: Jackson no lo deduce bien de
    // los métodos que genera Lombok para "aVerificar")
    @JsonProperty("aVerificar")
    private boolean aVerificar;

    // El total que vio recepción: si no coincide con el calculado (cambió un precio), el cobro no se registra
    private BigDecimal totalMostrado;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DescuentoEspecial {
        private BigDecimal monto;
        private String motivo;
    }
}
