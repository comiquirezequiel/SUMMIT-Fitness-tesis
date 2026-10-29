package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Ejercicio del catálogo (alta, edición y consulta).
 * patologiasContraindicadas: palabras separadas por coma (ej. "HERNIA,RODILLA") que se cruzan
 * con las patologías del certificado médico del socio.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EjercicioDTO {
    private Long idEjercicio;
    private String nombre;
    private String descripcion;
    private String grupoMuscular;
    private String urlMedia;
    private String svgTargetId;
    private String patologiasContraindicadas;
}
