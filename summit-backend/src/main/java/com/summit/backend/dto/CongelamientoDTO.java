package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Un congelamiento de membresía para la ficha del socio.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CongelamientoDTO {
    private Long idCongelamiento;
    private LocalDate desde;
    private LocalDate hasta;
    private int dias;                // días que se corrió el vencimiento
    private String motivo;           // VACACIONES, SALUD u OTRO
    private String observacion;
    private String estado;           // PROGRAMADO, EN_CURSO, TERMINADO o ANULADO
    private boolean terminadoAntes;
    private String registradoPor;
    private LocalDateTime fechaRegistro;
    private LocalDate vencimientoMembresia; // cómo quedó el vencimiento (solo al registrarlo o terminarlo)
    private String aviso;                   // algo a tener en cuenta (ej. débito automático); null si no hay
}
