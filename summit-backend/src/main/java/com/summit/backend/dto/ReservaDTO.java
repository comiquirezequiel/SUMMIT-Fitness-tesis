package com.summit.backend.dto;

import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;
@Builder
public record ReservaDTO(
        Long idReserva,
        Long idHorario,
        Long idSocio,
        String nombreSocio,
        String dni,
        LocalDate fechaClase,
        LocalDateTime fechaReserva,
        String estado) {
}
