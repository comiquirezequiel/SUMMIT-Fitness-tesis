package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Un cobro para el listado de caja (sin exponer la entidad completa del socio).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PagoListadoDTO {
    private Long idPago;
    private LocalDateTime fechaPago;
    private Long idSocio;
    private String nombreSocio;
    private String dniSocio;
    private String plan;
    private BigDecimal monto;
    private String metodoPago;
    private String comprobante;
}
