package com.summit.backend.dto;

// Lombok: genera getters, setters, builder y constructores (ver AnalisisCertificadoDTO).
import lombok.Builder;

import java.util.List;

/**
 * Ejercicios del catálogo que conviene evitar para un socio: los que marca la regla firme
 * (contraindicaciones del catálogo) y los que sugiere el asistente de IA, cada uno con su motivo.
 *
 * <p>Lo arma AsistenteIaService.ejerciciosAEvitar(...) y lo muestra el panel SugerenciasEjercicios
 * del Constructor de rutinas. No se guarda en la base: se calcula cada vez que se pide.</p>
 */
@Builder
public record SugerenciaEjerciciosDTO(
        String patologias,      // lo que se tuvo en cuenta (del certificado del socio)
        List<EjercicioAEvitar> ejercicios,
        String recomendacion,   // consejo general del asistente para el profesor
        String modelo,          // qué modelo hizo la sugerencia (trazabilidad)
        double segundos        // cuánto tardó
) {

    /**
     * Un ejercicio a evitar. Es una clase interna "static" porque solo tiene sentido dentro de esta respuesta
     * y no necesita acceder a la clase de afuera.
     */
    @Builder
    public record EjercicioAEvitar(
            Long idEjercicio,
            String nombre,
            String grupoMuscular,
            String motivo,              // explicación del asistente (o de la regla si la IA no lo marcó)
            // REGLA, IA o AMBOS: le muestra al profesor de dónde sale cada sugerencia. Lo que marca la REGLA
            // bloquea en el constructor (pide confirmación); lo que solo marca la IA es una sugerencia.
            String origen,
            List<String> riesgosRegla  // patologías que chocan según la regla firme
    ) {
    }
}
