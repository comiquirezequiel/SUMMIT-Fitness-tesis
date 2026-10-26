package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * El turno de caja abierto (desde el último cierre hasta ahora) o, en un cierre, el turno que cerró.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TurnoCajaDTO {

    /** Lo que entró y salió por un medio de pago. */
    public record TotalMetodo(String metodoPago, BigDecimal ingresos, BigDecimal egresos) {}

    private LocalDateTime desde;
    private LocalDateTime hasta;           // null en el turno abierto
    private BigDecimal fondoInicial;       // efectivo con el que empezó (el que dejó el cierre anterior)
    private List<TotalMetodo> metodos;     // solo los medios con movimientos
    private BigDecimal totalIngresos;
    private BigDecimal totalEgresos;
    private BigDecimal ingresosEfectivo;
    private BigDecimal egresosEfectivo;
    private BigDecimal efectivoEsperado;   // fondoInicial + ingresosEfectivo - egresosEfectivo
    private int cantidadCobros;
    private int cantidadGastos;
    private LocalDateTime ultimoCierre;    // cuándo fue el cierre anterior (null si nunca se cerró)
    private String ultimoCierrePor;
}
