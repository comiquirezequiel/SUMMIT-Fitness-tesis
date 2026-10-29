package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Un intento de ingreso para la "Actividad en vivo" de recepción.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IngresoDTO {
    private Long idLog;
    private LocalDateTime fechaHora;
    private Long idUsuario;
    private String nombre;
    private String dni;
    private String rol;
    private String resultado;
    private String tipoEvento;
    private Long fotoVersion; // null si no tiene foto (el personal nunca tiene)
}
