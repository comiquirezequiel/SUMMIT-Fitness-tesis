package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Adhesión de un socio al débito automático mensual de su plan (Mercado Pago Suscripciones).
 * Cada cobro que confirma Mercado Pago se registra como un PagoHistorial y extiende la membresía.
 */
@Entity
@Table(name = "debitos_automaticos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DebitoAutomatico {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_debito")
    private Long idDebito;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private Plan plan;

    // Monto que cobra Mercado Pago cada mes (se actualiza si el admin cambia el precio del plan)
    @Column(name = "monto", nullable = false, precision = 10, scale = 2)
    private BigDecimal monto;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "estado", nullable = false, length = 30)
    private EstadoDebito estado;

    // Id de la suscripción en Mercado Pago ("preapproval")
    @Column(name = "mp_preapproval_id", length = 64, unique = true)
    private String mpPreapprovalId;

    // Link donde el socio autoriza el débito (en recepción se muestra como QR)
    @Column(name = "link_autorizacion", length = 500)
    private String linkAutorizacion;

    // Email de la cuenta de Mercado Pago con la que paga (puede ser distinto del registrado en el gimnasio)
    @Column(name = "email_pagador", nullable = false, length = 100)
    private String emailPagador;

    // Medio con el que autorizó, según Mercado Pago (ej. account_money, debvisa, master)
    @Column(name = "medio_pago", length = 40)
    private String medioPago;

    @Column(name = "fecha_alta", nullable = false)
    private LocalDateTime fechaAlta;

    // Quién la dio de alta: el socio desde el portal o el empleado de recepción
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creado_por_id")
    private Usuario creadoPor;

    @Column(name = "proximo_cobro")
    private LocalDate proximoCobro;

    @Column(name = "ultimo_cobro")
    private LocalDateTime ultimoCobro;

    // Último cobro rechazado (sin saldo, tarjeta vencida...): recepción lo ve como alerta hasta que entre uno aprobado
    @Column(name = "ultimo_rechazo")
    private LocalDateTime ultimoRechazo;

    @Column(name = "detalle_rechazo", length = 150)
    private String detalleRechazo;

    @Column(name = "ultima_sincronizacion")
    private LocalDateTime ultimaSincronizacion;

    @Column(name = "fecha_baja")
    private LocalDateTime fechaBaja;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "baja_por_id")
    private Usuario bajaPor;

    @PrePersist
    public void prePersist() {
        if (this.fechaAlta == null) this.fechaAlta = LocalDateTime.now();
        if (this.estado == null) this.estado = EstadoDebito.PENDIENTE_AUTORIZACION;
    }
}
