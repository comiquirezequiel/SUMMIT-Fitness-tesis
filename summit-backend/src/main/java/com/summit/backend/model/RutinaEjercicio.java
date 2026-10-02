package com.summit.backend.model;

import lombok.*;
import jakarta.persistence.*;

@Entity
@Table(name = "rutina_ejercicios")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RutinaEjercicio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_rutina_ejercicio")
    private Long idRutinaEjercicio;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rutina_id", nullable = false)
    private Rutina rutina;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ejercicio_id", nullable = false)
    private Ejercicio ejercicio;

    @Column(name = "dia_numero")
    private Integer diaNumero; // Ej: Día 1, Día 2

    @Column(name = "series")
    private Integer series;

    @Column(name = "repeticiones")
    private Integer repeticiones;

    @Column(name = "peso_sugerido_kg")
    private Double pesoSugeridoKg;

    @Column(name = "descanso_segundos")
    private Integer descansoSegundos;
}
