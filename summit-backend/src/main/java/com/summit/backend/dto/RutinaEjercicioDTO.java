package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Un ejercicio dentro de la rutina, con los datos del catálogo que necesita la pantalla.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RutinaEjercicioDTO {
    private Long idRutinaEjercicio;
    private Long idEjercicio;
    private String nombreEjercicio;
    private String grupoMuscular;
    private String urlMedia;
    private Integer diaNumero;
    private Integer orden;
    private Integer series;
    private Integer repeticiones;
    private Double pesoSugeridoKg;
    private Integer descansoSegundos;
    private String observaciones;
}
