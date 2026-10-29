package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Tarea de seguimiento de un socio: contactarlo porque se le vence la cuota, se le venció, se le vence el apto o hace
 * días que no viene (automáticas), o por lo que haya cargado alguien del equipo (manuales).
 */
@Entity
@Table(name = "tareas_seguimiento")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TareaSeguimiento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_tarea")
    private Long idTarea;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tipo", nullable = false, length = 20)
    private TipoTarea tipo;

    @Column(name = "descripcion", nullable = false, length = 300)
    private String descripcion;

    // Para cuándo hay que hacerla
    @Column(name = "vence", nullable = false)
    private LocalDate vence;

    // La fecha que la originó: el vencimiento de la cuota o del apto, o el último ingreso (null si nunca vino o es manual)
    @Column(name = "fecha_referencia")
    private LocalDate fechaReferencia;

    // Identifica la situación de una automática (ej. "VENCIDA:12:2026-10-20"): la misma situación no genera dos tareas.
    // null en las manuales
    @Column(name = "clave", unique = true, length = 80)
    private String clave;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "estado", nullable = false, length = 20)
    @Builder.Default
    private EstadoTarea estado = EstadoTarea.PENDIENTE;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "canal", length = 20)
    private CanalContacto canal;

    // Qué pasó al hacerla (o por qué se resolvió sola)
    @Column(name = "nota", length = 300)
    private String nota;

    // Quién la cargó (null = automática)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creada_por_id")
    private Usuario creadaPor;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resuelta_por_id")
    private Usuario resueltaPor;

    @Column(name = "fecha_resolucion")
    private LocalDateTime fechaResolucion;

    @PrePersist
    protected void onCreate() {
        if (this.fechaCreacion == null) this.fechaCreacion = LocalDateTime.now();
    }
}
