package com.summit.backend.model;

import lombok.*;
import jakarta.persistence.*;
import java.time.LocalTime;

@Entity
@Table(name = "clase_horarios")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClaseHorario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_horario")
    private Long idHorario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clase_id", nullable = false)
    private Clase clase;

    @Enumerated(EnumType.STRING)
    @Column(name = "dia_semana", nullable = false, length = 15)
    private DiaSemana diaSemana;

    @Column(name = "hora_inicio", nullable = false)
    private LocalTime horaInicio;

    @Column(name = "hora_fin", nullable = false)
    private LocalTime horaFin;
}
