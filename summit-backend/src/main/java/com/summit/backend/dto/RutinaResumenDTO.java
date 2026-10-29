package com.summit.backend.dto;

import lombok.Builder;

import java.time.LocalDate;

/**
 * Fila del listado de rutinas activas del personal (sin el detalle de ejercicios).
 */
@Builder
public record RutinaResumenDTO(
        Long idRutina,
        String nombre,
        String objetivo,
        Long idSocio,
        String nombreSocio,
        Long idProfesor,
        String nombreProfesor,
        LocalDate fechaCreacion,
        int totalDias,
        long cantidadEjercicios) {
}
