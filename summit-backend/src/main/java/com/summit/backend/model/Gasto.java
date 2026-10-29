package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Gasto (egreso) de la caja: un pago del gimnasio. Uno pagado en efectivo sale de la caja de recepción, así que se
 * descuenta del efectivo esperado al cerrarla (salvo que lo haya pagado el dueño con su plata: "fuera de caja"). No se
 * borra: si se cargó mal, se anula con motivo (solo mientras el turno sigue abierto).
 */
@Entity
@Table(name = "gastos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Gasto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_gasto")
    private Long idGasto;

    @Column(name = "fecha", nullable = false)
    private LocalDateTime fecha;

    @Column(name = "monto", nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "categoria", nullable = false, length = 20)
    private CategoriaGasto categoria;

    @Column(name = "descripcion", nullable = false, length = 200)
    private String descripcion;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "metodo_pago", nullable = false, length = 30)
    private MetodoPago metodoPago;

    // En efectivo, pero no salió de la caja (lo pagó el dueño con su plata): cuenta como gasto, no en el arqueo.
    // columnDefinition con default: al agregar la columna a una base que ya tiene gastos, MySQL los completa con 0
    // (salieron de la caja)
    @Column(name = "fuera_de_caja", nullable = false, columnDefinition = "bit not null default 0")
    private boolean fueraDeCaja;

    @Column(name = "comprobante_nro", length = 50)
    private String comprobanteNro;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registrado_por_id")
    private Usuario registradoPor;

    @Column(name = "anulado", nullable = false)
    private boolean anulado;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "anulado_por_id")
    private Usuario anuladoPor;

    @Column(name = "fecha_anulacion")
    private LocalDateTime fechaAnulacion;

    @Column(name = "motivo_anulacion", length = 200)
    private String motivoAnulacion;

    @PrePersist
    protected void onCreate() {
        // Con la precisión que guarda la base (microsegundos): así no se redondea y queda exacto para los turnos de caja
        if (this.fecha == null) this.fecha = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }
}
