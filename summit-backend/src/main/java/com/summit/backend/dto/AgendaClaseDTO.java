package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

/**
 * Un horario de clase en la agenda de un día, con la cantidad de reservas de esa fecha.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgendaClaseDTO {
    private Long idHorario;
    private Long idClase;
    private String nombreClase;
    private String descripcion;
    private Long idProfesor;
    private String profesor;
    private String diaSemana;
    private LocalTime horaInicio;
    private LocalTime horaFin;
    private int capacidad;
    private long reservados;
}
