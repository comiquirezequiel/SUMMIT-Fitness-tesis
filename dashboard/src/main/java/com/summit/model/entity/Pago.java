package com.summit.model.entity;

import com.summit.model.enums.EstadoPago;
import com.summit.model.enums.MetodoPago;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "pago_historial")
public class Pago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_pago")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private Plan plan;

    @Column(name = "monto_abonado", nullable = false, precision = 10, scale = 2)
    private BigDecimal montoAbonado;

    @Column(name = "fecha_pago", nullable = false, updatable = false)
    private LocalDateTime fechaPago;

    @Enumerated(EnumType.STRING)
    @Column(name = "metodo_pago", nullable = false, length = 30)
    private MetodoPago metodoPago;

    // --- CAMPOS PARA EL MÓDULO FINANCIERO ---

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_pago", nullable = false, length = 20)
    private EstadoPago estadoPago;

    // 1. Para Mercado Pago (Checkout API / Webhooks)
    @Column(name = "mp_payment_id", unique = true)
    private String mpPaymentId; // Guarda el ID de transacción de MP para cruzarlo con el Webhook

    // 2 y 3. Para Flujo Manual y Trazabilidad (Auditoría de quién validó la transferencia)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "aprobado_por_usuario_id")
    private Usuario aprobadoPor; // Quién de recepción/admin le dio a "Aprobar"

    @PrePersist
    protected void onCreate() {
        this.fechaPago = LocalDateTime.now();
        // Si no se define estado al crear, arranca como PENDIENTE
        if (this.estadoPago == null) {
            this.estadoPago = EstadoPago.PENDIENTE;
        }
    }


    //GETTERS y SETTERS

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public void setUsuario(Usuario usuario) {
        this.usuario = usuario;
    }

    public Plan getPlan() {
        return plan;
    }

    public void setPlan(Plan plan) {
        this.plan = plan;
    }

    public BigDecimal getMontoAbonado() {
        return montoAbonado;
    }

    public void setMontoAbonado(BigDecimal montoAbonado) {
        this.montoAbonado = montoAbonado;
    }

    public LocalDateTime getFechaPago() {
        return fechaPago;
    }

    public void setFechaPago(LocalDateTime fechaPago) {
        this.fechaPago = fechaPago;
    }

    public MetodoPago getMetodoPago() {
        return metodoPago;
    }

    public void setMetodoPago(MetodoPago metodoPago) {
        this.metodoPago = metodoPago;
    }

    public EstadoPago getEstadoPago() {
        return estadoPago;
    }

    public void setEstadoPago(EstadoPago estadoPago) {
        this.estadoPago = estadoPago;
    }

    public String getMpPaymentId() {
        return mpPaymentId;
    }

    public void setMpPaymentId(String mpPaymentId) {
        this.mpPaymentId = mpPaymentId;
    }

    public Usuario getAprobadoPor() {
        return aprobadoPor;
    }

    public void setAprobadoPor(Usuario aprobadoPor) {
        this.aprobadoPor = aprobadoPor;
    }

}