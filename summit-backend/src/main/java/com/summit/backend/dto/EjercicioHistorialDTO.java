package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Un ejercicio que el socio ya entrenó y cuántos registros tiene (para elegir qué graficar).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EjercicioHistorialDTO {
    private Long idEjercicio;
    private String nombreEjercicio;
    private String grupoMuscular;
    private long registros;
}
