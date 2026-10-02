package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Rutina de un socio con sus ejercicios ordenados por día y orden.
 * totalDias es el último día con ejercicios (0 si la rutina está vacía).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RutinaDTO {
    private Long idRutina;
    private String nombre;
    private String objetivo;
    private Long idSocio;
    private String nombreSocio;
    private Long idProfesor;
    private String nombreProfesor;
    private LocalDate fechaCreacion;
    private Boolean activa;
    private int totalDias;
    private List<RutinaEjercicioDTO> ejercicios;
}
