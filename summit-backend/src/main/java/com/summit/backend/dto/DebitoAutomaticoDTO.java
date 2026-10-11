package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Una adhesión al débito automático, para la ficha del socio, el listado de recepción y el portal.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DebitoAutomaticoDTO {
    private Long idDebito;
    private Long idSocio;
    private String nombreSocio;
    private String dniSocio;
    private Long idPlan;
    private String plan;
    private BigDecimal monto;
    private String estado;              // PENDIENTE_AUTORIZACION, ACTIVO, PAUSADO o CANCELADO
    private String linkAutorizacion;    // solo mientras falta autorizar
    private String emailPagador;
    private String medioPago;
    private LocalDateTime fechaAlta;
    private String creadoPor;
    private LocalDate proximoCobro;
    private LocalDateTime ultimoCobro;
    private LocalDateTime ultimoRechazo;
    private String detalleRechazo;
    private LocalDateTime fechaBaja;
    private LocalDateTime ultimaSincronizacion;
}
