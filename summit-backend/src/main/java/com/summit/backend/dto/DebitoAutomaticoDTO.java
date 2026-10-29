package com.summit.backend.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Una adhesión al débito automático, para la ficha del socio y el listado de recepción.
 */
@Builder
public record DebitoAutomaticoDTO(
        Long idDebito,
        Long idSocio,
        String nombreSocio,
        String dniSocio,
        Long idPlan,
        String plan,
        BigDecimal monto,
        String estado, // PENDIENTE_AUTORIZACION, ACTIVO, PAUSADO o CANCELADO
        String linkAutorizacion, // solo mientras falta autorizar
        String emailPagador,
        String medioPago,
        LocalDateTime fechaAlta,
        String creadoPor,
        LocalDate proximoCobro,
        LocalDateTime ultimoCobro,
        LocalDateTime ultimoRechazo,
        String detalleRechazo,
        LocalDateTime fechaBaja,
        LocalDateTime ultimaSincronizacion) {
}
