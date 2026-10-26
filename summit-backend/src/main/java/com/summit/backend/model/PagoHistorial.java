package com.summit.backend.model;

import lombok.*;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "pago_historial")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PagoHistorial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_pago")
    private Long idPago;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private Plan plan;

    @Column(name = "monto_abonado", nullable = false, precision = 10, scale = 2)
    private BigDecimal montoAbonado;

    @Column(name = "fecha_pago", nullable = false)
    private LocalDateTime fechaPago;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR) // texto, no ENUM de MySQL: agregar valores no rompe la base
    @Column(name = "metodo_pago", nullable = false, length = 30)
    private MetodoPago metodoPago;

    @Column(name = "comprobante_nro", length = 50)
    private String comprobanteNro;

    // Solo un pago APROBADO extiende la membresía y suma en la caja.
    // columnDefinition con default: al agregar la columna a una base que ya tiene pagos, MySQL los completa
    // con 'APROBADO' (sin default quedarían vacíos y Java no podría leerlos como EstadoPago).
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "estado_pago", nullable = false, length = 20,
            columnDefinition = "varchar(20) not null default 'APROBADO'")
    @Builder.Default
    private EstadoPago estadoPago = EstadoPago.APROBADO;

    // Id del cobro en Mercado Pago (débito automático). Único: un mismo cobro nunca se registra dos veces.
    @Column(name = "mp_payment_id", length = 40, unique = true)
    private String mpPaymentId;

    // Empleado que registró el cobro en recepción (null en los cobros automáticos)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registrado_por_id")
    private Usuario registradoPor;

    // Quién confirmó o rechazó un pago que quedó "a verificar", y cuándo
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verificado_por_id")
    private Usuario verificadoPor;

    @Column(name = "fecha_verificacion")
    private LocalDateTime fechaVerificacion;

    // Detalle del cobro para el comprobante y la caja: montoAbonado = precioLista - descuentoMonto + matriculaMonto.
    // Los cobros anteriores a este detalle (y los débitos automáticos) los tienen en null
    @Column(name = "precio_lista", precision = 10, scale = 2)
    private BigDecimal precioLista;

    // Nombre del descuento del catálogo, o "Especial: <motivo>". null = sin descuento
    @Column(name = "descuento_nombre", length = 120)
    private String descuentoNombre;

    @Column(name = "descuento_monto", precision = 10, scale = 2)
    private BigDecimal descuentoMonto;

    // null = no correspondía matrícula; 0 = correspondía y se bonificó; más de 0 = se cobró
    @Column(name = "matricula_monto", precision = 10, scale = 2)
    private BigDecimal matriculaMonto;

    // Hasta cuándo quedó paga la membresía con este cobro (para el comprobante). null mientras está a verificar, en los
    // rechazados y en los cobros anteriores a este dato
    @Column(name = "vence_membresia")
    private LocalDate venceMembresia;

    @PrePersist
    public void prePersist() {
        if (this.fechaPago == null) this.fechaPago = LocalDateTime.now();
        if (this.estadoPago == null) this.estadoPago = EstadoPago.APROBADO;
    }
}
