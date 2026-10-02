package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Un ejercicio entrenado en una fecha. registradoPor es el nombre de quien lo cargó
 * (el socio o el profesor). idRutinaEjercicio es null si el ejercicio ya no está en la rutina.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogEntrenamientoDTO {
    private Long idLog;
    private Long idSocio;
    private Long idRutina;
    private Long idRutinaEjercicio;
    private Long idEjercicio;
    private String nombreEjercicio;
    private LocalDate fecha;
    private Integer diaNumero;
    private Double pesoKg;
    private Integer repeticiones;
    private Integer series;
    private Integer rpe;
    private String comentario;
    private String registradoPor;
    private LocalDateTime fechaRegistro;
}
