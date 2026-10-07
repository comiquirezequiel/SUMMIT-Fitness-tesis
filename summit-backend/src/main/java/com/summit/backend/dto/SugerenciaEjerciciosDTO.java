package com.summit.backend.dto;

// Lombok: genera getters, setters, builder y constructores (ver AnalisisCertificadoDTO).
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Ejercicios del catálogo que conviene evitar para un socio: los que marca la regla firme
 * (contraindicaciones del catálogo) y los que sugiere el asistente de IA, cada uno con su motivo.
 *
 * <p>Lo arma AsistenteIaService.ejerciciosAEvitar(...) y lo muestra el panel SugerenciasEjercicios
 * del Constructor de rutinas. No se guarda en la base: se calcula cada vez que se pide.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SugerenciaEjerciciosDTO {
    private String patologias;      // lo que se tuvo en cuenta (del certificado del socio)
    private List<EjercicioAEvitar> ejercicios;
    private String recomendacion;   // consejo general del asistente para el profesor
    private String modelo;          // qué modelo hizo la sugerencia (trazabilidad)
    private double segundos;        // cuánto tardó

    /**
     * Un ejercicio a evitar. Es una clase interna "static" porque solo tiene sentido dentro de esta respuesta
     * y no necesita acceder a la clase de afuera.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EjercicioAEvitar {
        private Long idEjercicio;
        private String nombre;
        private String grupoMuscular;
        private String motivo;              // explicación del asistente (o de la regla si la IA no lo marcó)
        // REGLA, IA o AMBOS: le muestra al profesor de dónde sale cada sugerencia. Lo que marca la REGLA
        // bloquea en el constructor (pide confirmación); lo que solo marca la IA es una sugerencia.
        private String origen;
        private List<String> riesgosRegla;  // patologías que chocan según la regla firme
    }
}
