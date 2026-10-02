package com.summit.backend.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Rutina del día del socio: qué día le toca, sus ejercicios, lo que ya cargó hoy
 * y lo que hizo la vez pasada en cada ejercicio.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RutinaHoyDTO {
    private Long idRutina;
    private String nombreRutina;
    private LocalDate fecha;
    private int diaNumero;
    private int totalDias;
    private boolean yaEntrenoHoy;
    private List<EjercicioDelDia> ejercicios;

    /**
     * Los campos de RutinaEjercicioDTO (en el mismo nivel del JSON) más los registros del socio.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EjercicioDelDia {
        @JsonUnwrapped
        private RutinaEjercicioDTO ejercicio;
        private RegistroHoy registroHoy;         // null si todavía no lo cargó hoy
        private UltimoRegistro ultimoRegistro;   // null si nunca lo hizo antes de hoy
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RegistroHoy {
        private Long idLog;
        private Double pesoKg;
        private Integer repeticiones;
        private Integer series;
        private Integer rpe;
        private String comentario;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UltimoRegistro {
        private LocalDate fecha;
        private Double pesoKg;
        private Integer repeticiones;
        private Integer series;
        private Integer rpe;
    }
}
