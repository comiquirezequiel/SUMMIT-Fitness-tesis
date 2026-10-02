package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Registro de un ejercicio de la rutina: rpe obligatorio (1 a 10); fecha opcional (hoy por defecto);
 * series y repeticiones, si no vienen, son las indicadas en la rutina.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LogEntrenamientoRequestDTO {
    private Long idRutinaEjercicio;
    private Double pesoKg;
    private Integer repeticiones;
    private Integer series;
    private Integer rpe;
    private String comentario;
    private LocalDate fecha;
}
