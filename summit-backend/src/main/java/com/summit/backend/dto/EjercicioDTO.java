package com.summit.backend.dto;

import lombok.Builder;

/**
 * Ejercicio del catálogo (alta, edición y consulta).
 * patologiasContraindicadas: palabras separadas por coma (ej. "HERNIA,RODILLA") que se cruzan
 * con las patologías del certificado médico del socio.
 */
@Builder
public record EjercicioDTO(
        Long idEjercicio,
        String nombre,
        String descripcion,
        String grupoMuscular,
        String urlMedia,
        String svgTargetId,
        String patologiasContraindicadas
) {
}
