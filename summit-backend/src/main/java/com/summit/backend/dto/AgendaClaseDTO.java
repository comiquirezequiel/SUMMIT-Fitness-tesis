package com.summit.backend.dto;

import lombok.Builder;

import java.time.LocalTime;

/**
 * Un horario de clase en la agenda de un día, con la cantidad de reservas de esa fecha.
 */
@Builder
public record AgendaClaseDTO(
        Long idHorario,
        Long idClase,
        String nombreClase,
        String descripcion,
        Long idProfesor,
        String profesor,
        String diaSemana,
        LocalTime horaInicio,
        LocalTime horaFin,
        int capacidad,
        long reservados) {
}
