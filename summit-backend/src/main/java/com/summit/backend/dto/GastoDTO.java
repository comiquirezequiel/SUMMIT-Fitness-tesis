package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Un gasto de la caja para el listado.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GastoDTO {
    private Long idGasto;
    private LocalDateTime fecha;
    private BigDecimal monto;
    private String categoria;
    private String descripcion;
    private String metodoPago;
    private String comprobante;
    private String registradoPor;
    private boolean anulado;
    private String anuladoPor;
    private LocalDateTime fechaAnulacion;
    private String motivoAnulacion;
    private boolean anulable; // del turno abierto y sin anular: todavía se puede anular
}
