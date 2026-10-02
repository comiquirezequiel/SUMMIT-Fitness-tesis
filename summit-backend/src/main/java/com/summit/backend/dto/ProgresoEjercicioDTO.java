package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Un punto del gráfico de progreso de un ejercicio (volumenKg = peso × repeticiones × series).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProgresoEjercicioDTO {
    private LocalDate fecha;
    private Double pesoKg;
    private Integer repeticiones;
    private Integer series;
    private Integer rpe;
    private Double volumenKg;
}
