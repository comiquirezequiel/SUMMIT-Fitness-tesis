package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Un cierre de caja (arqueo) con la foto del turno que cerró.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CierreCajaDTO {
    private Long idCierre;
    private LocalDateTime desde;
    private LocalDateTime hasta;
    private BigDecimal fondoInicial;
    private BigDecimal ingresosEfectivo;
    private BigDecimal egresosEfectivo;
    private BigDecimal efectivoEsperado;
    private BigDecimal efectivoContado;
    private BigDecimal diferencia;      // negativo = faltante, positivo = sobrante
    private BigDecimal retiro;
    private BigDecimal fondoSiguiente;
    private BigDecimal totalIngresos;
    private BigDecimal totalEgresos;
    private int cantidadCobros;
    private int cantidadGastos;
    private String observacion;
    private String cerradoPor;
    private List<TurnoCajaDTO.TotalMetodo> metodos;
}
