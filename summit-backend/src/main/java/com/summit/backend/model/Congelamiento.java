package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Congelamiento de una membresía (vacaciones, una lesión...): mientras dura, el socio no puede ingresar y el
 * vencimiento de su membresía se corre esos días. Si vuelve antes, se termina y se le descuentan los días que no usó;
 * si todavía no empezó, se anula y se le descuentan todos.
 */
@Entity
@Table(name = "congelamientos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Congelamiento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_congelamiento")
    private Long idCongelamiento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    // La membresía a la que se le corrió el vencimiento
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "suscripcion_id", nullable = false)
    private Suscripcion suscripcion;

    // Primer y último día congelado (los dos incluidos)
    @Column(name = "desde", nullable = false)
    private LocalDate desde;

    @Column(name = "hasta", nullable = false)
    private LocalDate hasta;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "motivo", nullable = false, length = 20)
    private MotivoCongelamiento motivo;

    @Column(name = "observacion", length = 200)
    private String observacion;

    // Días que se le sumaron al vencimiento (0 si se anuló antes de empezar)
    @Column(name = "dias_aplicados", nullable = false)
    private int diasAplicados;

    // Volvió antes de lo previsto: "hasta" pasó a ser el día anterior a su vuelta
    @Column(name = "terminado_antes", nullable = false)
    private boolean terminadoAntes;

    // Se anuló antes de empezar: no corrió el vencimiento
    @Column(name = "anulado", nullable = false)
    private boolean anulado;

    // Empleado que lo cargó
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registrado_por_id")
    private Usuario registradoPor;

    @Column(name = "fecha_registro", nullable = false)
    private LocalDateTime fechaRegistro;

    @PrePersist
    protected void onCreate() {
        if (this.fechaRegistro == null) this.fechaRegistro = LocalDateTime.now();
    }
}
