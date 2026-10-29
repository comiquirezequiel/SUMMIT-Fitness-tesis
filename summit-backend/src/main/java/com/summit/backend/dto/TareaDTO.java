package com.summit.backend.dto;

import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Una tarea de seguimiento con los datos del socio para contactarlo.
 */
@Builder
public record TareaDTO(
        Long idTarea,
        Long idSocio,
        String nombreSocio,
        String dniSocio,
        String telefonoSocio,
        String tipo,               // CUOTA_POR_VENCER, CUOTA_VENCIDA, APTO_POR_VENCER, INACTIVO o MANUAL
        String descripcion,
        LocalDate vence,
        LocalDate fechaReferencia, // vencimiento de la cuota o del apto, o el último ingreso
        String estado,
        String canal,
        String nota,
        String creadaPor,          // null = automática
        LocalDateTime fechaCreacion,
        String resueltaPor,
        LocalDateTime fechaResolucion
) {
}
