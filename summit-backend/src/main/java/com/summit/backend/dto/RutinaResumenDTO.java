package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Fila del listado de rutinas activas del personal (sin el detalle de ejercicios).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RutinaResumenDTO {
    private Long idRutina;
    private String nombre;
    private String objetivo;
    private Long idSocio;
    private String nombreSocio;
    private Long idProfesor;
    private String nombreProfesor;
    private LocalDate fechaCreacion;
    private int totalDias;
    private long cantidadEjercicios;
}
