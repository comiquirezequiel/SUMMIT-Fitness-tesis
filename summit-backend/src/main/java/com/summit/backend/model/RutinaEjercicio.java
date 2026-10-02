package com.summit.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
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

    @JsonIgnore // evita el ciclo Rutina -> ejercicios -> rutina al serializar
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rutina_id", nullable = false)
    private Rutina rutina;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ejercicio_id", nullable = false)
    private Ejercicio ejercicio;

    @Column(name = "dia_numero")
    private Integer diaNumero; // Día 1 a 7. Las rutinas armadas antes de los días lo tienen vacío: cuenta como día 1

    @Column(name = "orden")
    private Integer orden; // Posición dentro del día (1, 2, 3...)

    @Column(name = "series")
    private Integer series;

    @Column(name = "repeticiones")
    private Integer repeticiones;

    @Column(name = "peso_sugerido_kg")
    private Double pesoSugeridoKg;

    @Column(name = "descanso_segundos")
    private Integer descansoSegundos;

    @Column(name = "observaciones", length = 300)
    private String observaciones;
}
