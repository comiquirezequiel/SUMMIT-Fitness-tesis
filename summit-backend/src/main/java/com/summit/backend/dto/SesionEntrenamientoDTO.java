package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Resumen de una sesión: lo que el socio registró en una fecha para un día de su rutina.
 * tonelajeKg = suma de peso × repeticiones × series de los ejercicios registrados.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SesionEntrenamientoDTO {
    private LocalDate fecha;
    private Long idRutina;
    private String nombreRutina;
    private Integer diaNumero;
    private int ejerciciosRegistrados;
    private Double rpePromedio;
    private Double tonelajeKg;
}
