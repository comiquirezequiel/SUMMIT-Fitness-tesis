package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Reglas de las membresías que define el dueño (Membresías > Descuentos y reglas). Hay una sola fila (id 1).
 */
@Entity
@Table(name = "reglas_membresia")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReglasMembresia {

    @Id
    @Column(name = "id_reglas")
    private Long idReglas;

    // Matrícula de inscripción. 0 = el gimnasio no cobra matrícula
    @Column(name = "matricula_monto", nullable = false, precision = 10, scale = 2)
    private BigDecimal matriculaMonto;

    // Se vuelve a cobrar si el socio estuvo más de estos días sin cuota. 0 = solo en la primera inscripción
    @Column(name = "matricula_reinscripcion_dias", nullable = false)
    private int matriculaReinscripcionDias;

    // Días mínimos de cada congelamiento
    @Column(name = "congelamiento_min_dias", nullable = false)
    private int congelamientoMinDias;

    // Días máximos de congelamiento por año calendario. 0 = el gimnasio no congela membresías
    @Column(name = "congelamiento_max_dias_anio", nullable = false)
    private int congelamientoMaxDiasAnio;
}
