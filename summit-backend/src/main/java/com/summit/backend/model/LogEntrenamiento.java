package com.summit.backend.model;

import lombok.*;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Lo que el socio entrenó de su rutina en una fecha: peso levantado, repeticiones, series y RPE.
 * Guarda la rutina, el ejercicio y el día por separado: si el profesor quita el ejercicio de la
 * rutina, rutinaEjercicio queda en null y el historial se conserva.
 */
@Entity
@Table(name = "logs_entrenamiento",
        // Un registro por ejercicio de la rutina y fecha: si se vuelve a cargar, se actualiza
        uniqueConstraints = @UniqueConstraint(name = "uk_log_entrenamiento_ejercicio_fecha",
                columnNames = {"rutina_ejercicio_id", "fecha"}),
        indexes = {
                @Index(name = "idx_log_entrenamiento_socio_fecha", columnList = "socio_id, fecha"),
                @Index(name = "idx_log_entrenamiento_socio_ejercicio", columnList = "socio_id, ejercicio_id, fecha")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LogEntrenamiento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_log")
    private Long idLog;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "socio_id", nullable = false)
    private Usuario socio;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rutina_id", nullable = false)
    private Rutina rutina;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rutina_ejercicio_id")
    private RutinaEjercicio rutinaEjercicio; // null si el profesor quitó el ejercicio de la rutina

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ejercicio_id", nullable = false)
    private Ejercicio ejercicio;

    @Column(name = "fecha", nullable = false)
    private LocalDate fecha;

    @Column(name = "dia_numero", nullable = false)
    private Integer diaNumero;

    @Column(name = "peso_kg")
    private Double pesoKg; // vacío en ejercicios con el peso del cuerpo

    @Column(name = "repeticiones")
    private Integer repeticiones;

    @Column(name = "series")
    private Integer series;

    @Column(name = "rpe", nullable = false)
    private Integer rpe; // Esfuerzo percibido, escala 1 a 10

    @Column(name = "comentario", length = 300)
    private String comentario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registrado_por_id", nullable = false)
    private Usuario registradoPor; // El socio o el profesor que lo cargó por él

    @Column(name = "fecha_registro", nullable = false)
    private LocalDateTime fechaRegistro;

    @PrePersist
    public void prePersist() {
        if (this.fechaRegistro == null) this.fechaRegistro = LocalDateTime.now();
    }
}
