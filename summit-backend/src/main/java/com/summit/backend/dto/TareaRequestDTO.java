package com.summit.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Tarea de seguimiento que carga alguien del equipo.
 */
public record TareaRequestDTO(
        @NotNull(message = "Elegí el socio")
        Long idSocio,

        @NotBlank(message = "Escribí qué hay que hacer")
        @Size(min = 3, max = 300, message = "La tarea tiene que tener entre 3 y 300 caracteres")
        String descripcion,

        // null = para hoy
        LocalDate vence
) {
}
