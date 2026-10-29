package com.summit.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Tarea de seguimiento que carga alguien del equipo.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TareaRequestDTO {

    @NotNull(message = "Elegí el socio")
    private Long idSocio;

    @NotBlank(message = "Escribí qué hay que hacer")
    @Size(min = 3, max = 300, message = "La tarea tiene que tener entre 3 y 300 caracteres")
    private String descripcion;

    // null = para hoy
    private LocalDate vence;
}
