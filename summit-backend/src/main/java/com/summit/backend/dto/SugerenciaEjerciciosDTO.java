package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Ejercicios del catálogo que conviene evitar para un socio: los que marca la regla firme
 * (contraindicaciones del catálogo) y los que sugiere el asistente de IA, cada uno con su motivo.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SugerenciaEjerciciosDTO {
    private String patologias;      // lo que se tuvo en cuenta (del certificado del socio)
    private List<EjercicioAEvitar> ejercicios;
    private String recomendacion;   // consejo general del asistente para el profesor
    private String modelo;
    private double segundos;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EjercicioAEvitar {
        private Long idEjercicio;
        private String nombre;
        private String grupoMuscular;
        private String motivo;              // explicación del asistente (o de la regla si la IA no lo marcó)
        private String origen;              // REGLA, IA o AMBOS
        private List<String> riesgosRegla;  // patologías que chocan según la regla firme
    }
}
