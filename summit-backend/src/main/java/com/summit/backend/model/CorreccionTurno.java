package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Corrección de un turno del personal: quién la hizo, cuándo, por qué y las horas de antes y de después. Las hace el
 * admin desde Asistencia del personal, o recepción en el momento ("era una entrada" / "era la salida").
 */
@Entity
@Table(name = "correcciones_turno", indexes = @Index(name = "idx_correcciones_turno", columnList = "turno_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CorreccionTurno {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_correccion")
    private Long idCorreccion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "turno_id", nullable = false)
    private TurnoPersonal turno;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR) // texto, no ENUM de MySQL: agregar valores no rompe la base
    @Column(name = "accion", nullable = false, length = 20)
    private AccionCorreccion accion;

    // Horas antes y después (en un alta, las de antes quedan vacías; al anular, las de después)
    @Column(name = "entrada_anterior")
    private LocalDateTime entradaAnterior;

    @Column(name = "salida_anterior")
    private LocalDateTime salidaAnterior;

    @Column(name = "entrada_nueva")
    private LocalDateTime entradaNueva;

    @Column(name = "salida_nueva")
    private LocalDateTime salidaNueva;

    @Column(name = "motivo", nullable = false, length = 200)
    private String motivo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "autor_id", nullable = false)
    private Usuario autor;

    @Column(name = "fecha", nullable = false)
    private LocalDateTime fecha;
}
