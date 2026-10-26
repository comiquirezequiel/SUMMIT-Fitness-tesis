package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Cierre de caja (arqueo) de un turno: desde el cierre anterior hasta este. Guarda la foto de ese momento: lo que
 * entró y salió por cada medio de pago, el efectivo que tendría que haber, el que se contó, la diferencia, lo que se
 * retiró y lo que quedó de fondo para el turno siguiente.
 */
@Entity
@Table(name = "cierres_caja")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CierreCaja {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cierre")
    private Long idCierre;

    // Comienzo del turno: el momento del cierre anterior (o el comienzo del día, en el primero). Único: dos personas
    // que cierran la misma caja a la vez no pueden guardar los dos cierres
    @Column(name = "desde", nullable = false, unique = true)
    private LocalDateTime desde;

    // El momento del cierre (fin del turno)
    @Column(name = "hasta", nullable = false)
    private LocalDateTime hasta;

    // Efectivo que había en la caja al empezar el turno (el fondo que dejó el cierre anterior)
    @Column(name = "fondo_inicial", nullable = false, precision = 12, scale = 2)
    private BigDecimal fondoInicial;

    @Column(name = "ingresos_efectivo", nullable = false, precision = 12, scale = 2)
    private BigDecimal ingresosEfectivo;

    @Column(name = "egresos_efectivo", nullable = false, precision = 12, scale = 2)
    private BigDecimal egresosEfectivo;

    // fondoInicial + ingresosEfectivo - egresosEfectivo
    @Column(name = "efectivo_esperado", nullable = false, precision = 12, scale = 2)
    private BigDecimal efectivoEsperado;

    @Column(name = "efectivo_contado", nullable = false, precision = 12, scale = 2)
    private BigDecimal efectivoContado;

    // efectivoContado - efectivoEsperado: negativo = faltante, positivo = sobrante
    @Column(name = "diferencia", nullable = false, precision = 12, scale = 2)
    private BigDecimal diferencia;

    // Efectivo que se retiró de la caja al cerrar (el que se lleva el dueño)
    @Column(name = "retiro", nullable = false, precision = 12, scale = 2)
    private BigDecimal retiro;

    // Efectivo que queda en la caja para el turno siguiente (efectivoContado - retiro)
    @Column(name = "fondo_siguiente", nullable = false, precision = 12, scale = 2)
    private BigDecimal fondoSiguiente;

    // Todos los medios de pago
    @Column(name = "total_ingresos", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalIngresos;

    @Column(name = "total_egresos", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalEgresos;

    @Column(name = "cantidad_cobros", nullable = false)
    private int cantidadCobros;

    @Column(name = "cantidad_gastos", nullable = false)
    private int cantidadGastos;

    @Column(name = "observacion", length = 300)
    private String observacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cerrado_por_id")
    private Usuario cerradoPor;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "cierres_caja_metodos", joinColumns = @JoinColumn(name = "cierre_id"))
    @Builder.Default
    private List<TotalMetodoCierre> metodos = new ArrayList<>();
}
