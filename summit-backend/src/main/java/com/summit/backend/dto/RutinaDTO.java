package com.summit.backend.dto;

import lombok.Builder;

import java.time.LocalDate;
import java.util.List;

/**
 * Rutina de un socio con sus ejercicios ordenados por día y orden.
 * totalDias es el último día con ejercicios (0 si la rutina está vacía).
 */
@Builder
public record RutinaDTO(
        Long idRutina,
        String nombre,
        String objetivo,
        Long idSocio,
        String nombreSocio,
        Long idProfesor,
        String nombreProfesor,
        LocalDate fechaCreacion,
        Boolean activa,
        int totalDias,
        List<RutinaEjercicioDTO> ejercicios) {
}
