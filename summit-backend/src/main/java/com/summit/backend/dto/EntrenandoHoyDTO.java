package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Socio que registró entrenamientos hoy: su avance en el día de la rutina que está haciendo.
 * totalEjercicios = ejercicios que tiene hoy ese día en la rutina; ultimoRegistro = hora de la última carga.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EntrenandoHoyDTO {
    private Long idSocio;
    private String nombreSocio;
    private Long idRutina;
    private String nombreRutina;
    private Integer diaNumero;
    private long ejerciciosRegistrados;
    private long totalEjercicios;
    private Double rpePromedio;
    private LocalDateTime ultimoRegistro;
}
