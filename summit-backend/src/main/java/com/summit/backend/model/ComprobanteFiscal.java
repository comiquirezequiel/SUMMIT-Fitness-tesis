package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Factura o nota de crédito electrónica de un cobro. Se crea PENDIENTE en la misma transacción que aprueba el pago
 * (así ningún cobro queda sin facturar) y FacturacionService le pide el CAE a ARCA. Una vez autorizado no se modifica
 * ni se borra: se anula con una nota de crédito.
 * El número es correlativo por ambiente, CUIT, tipo y punto de venta; mientras está pendiente no tiene.
 */
@Entity
@Table(name = "comprobantes_fiscales",
        uniqueConstraints = @UniqueConstraint(name = "uk_comprobante_numero",
                columnNames = {"ambiente", "cuit_emisor", "tipo", "punto_venta", "numero"}),
        indexes = {@Index(name = "idx_comprobante_cola", columnList = "ambiente, estado, proximo_intento"),
                @Index(name = "idx_comprobante_pago", columnList = "pago_id")})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ComprobanteFiscal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_comprobante")
    private Long idComprobante;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pago_id", nullable = false)
    private PagoHistorial pago;

    // En una nota de crédito: la factura que anula
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "comprobante_asociado_id")
    private ComprobanteFiscal asociado;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "ambiente", nullable = false, length = 15)
    private AmbienteArca ambiente;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "estado", nullable = false, length = 15)
    private EstadoComprobante estado;

    @Column(name = "nota_credito", nullable = false)
    private boolean notaCredito;

    // La letra de una factura sale de los datos fiscales del momento en que se envía: hasta entonces es null
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tipo", length = 20)
    private TipoComprobante tipo;

    @Column(name = "punto_venta")
    private Integer puntoVenta;

    @Column(name = "numero")
    private Long numero;

    @Column(name = "fecha")
    private LocalDate fecha;

    // Emisor tal como era al emitirlo (lo que va impreso)
    @Column(name = "cuit_emisor", length = 11)
    private String cuitEmisor;

    @Column(name = "emisor_razon_social", length = 100)
    private String emisorRazonSocial;

    @Column(name = "emisor_domicilio", length = 150)
    private String emisorDomicilio;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "emisor_condicion_iva", length = 30)
    private CondicionIva emisorCondicionIva;

    @Column(name = "emisor_ingresos_brutos", length = 30)
    private String emisorIngresosBrutos;

    @Column(name = "emisor_inicio_actividades")
    private LocalDate emisorInicioActividades;

    // Receptor: a consumidor final (DocTipo 99, número 0) o, si se identifica, con el DNI del socio (DocTipo 96)
    @Column(name = "identificar_receptor", nullable = false)
    private boolean identificarReceptor;

    @Column(name = "doc_tipo")
    private Integer docTipo;

    @Column(name = "doc_nro")
    private Long docNro;

    @Column(name = "condicion_iva_receptor")
    private Integer condicionIvaReceptor;

    @Column(name = "receptor_nombre", length = 120)
    private String receptorNombre;

    @Column(name = "imp_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal impTotal;

    @Column(name = "imp_neto", precision = 12, scale = 2)
    private BigDecimal impNeto;

    @Column(name = "imp_iva", precision = 12, scale = 2)
    private BigDecimal impIva;

    // Período del servicio facturado (la membresía que se pagó) y vencimiento del pago
    @Column(name = "servicio_desde")
    private LocalDate servicioDesde;

    @Column(name = "servicio_hasta")
    private LocalDate servicioHasta;

    @Column(name = "vencimiento_pago")
    private LocalDate vencimientoPago;

    // Nota de crédito: por qué se anuló la factura
    @Column(name = "motivo", length = 200)
    private String motivo;

    @Column(name = "cae", length = 14)
    private String cae;

    @Column(name = "cae_vencimiento")
    private LocalDate caeVencimiento;

    // Observaciones o errores de ARCA ("código: mensaje", uno por línea)
    @Column(name = "observaciones", columnDefinition = "TEXT")
    private String observaciones;

    @Column(name = "intentos", nullable = false)
    private int intentos;

    @Column(name = "proximo_intento")
    private LocalDateTime proximoIntento;

    @Column(name = "ultimo_error", length = 500)
    private String ultimoError;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "solicitado_por_id")
    private Usuario solicitadoPor;

    @Column(name = "creado", nullable = false)
    private LocalDateTime creado;

    @Column(name = "autorizado")
    private LocalDateTime autorizado;

    // Auditoría: el último pedido a ARCA y su respuesta, sin el token ni la firma del permiso de acceso
    @Column(name = "ultimo_pedido", columnDefinition = "TEXT")
    private String ultimoPedido;

    @Column(name = "ultima_respuesta", columnDefinition = "TEXT")
    private String ultimaRespuesta;

    @Version
    @Column(name = "version")
    private Long version;

    @PrePersist
    protected void onCreate() {
        if (this.creado == null) this.creado = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }

    /** "00002-00000154", o null si todavía no tiene número. */
    public String numeroCompleto() {
        return numero == null || puntoVenta == null ? null : String.format("%05d-%08d", puntoVenta, numero);
    }
}
