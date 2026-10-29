package com.summit.backend.dto;

import lombok.Builder;

import java.time.LocalDateTime;

/**
 * Un intento de ingreso para la "Actividad en vivo" de recepción.
 */
@Builder
public record IngresoDTO(
        Long idLog,
        LocalDateTime fechaHora,
        Long idUsuario,
        String nombre,
        String dni,
        String rol,
        String resultado,
        String tipoEvento,
        Long fotoVersion) { // null si no tiene foto (el personal nunca tiene)
}
