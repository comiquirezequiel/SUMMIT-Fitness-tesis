package com.summit.backend.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Un cierre de caja (arqueo) con la foto del turno que cerró.
 */
@Builder
public record CierreCajaDTO(
        Long idCierre,
        LocalDateTime desde,
        LocalDateTime hasta,
        BigDecimal fondoInicial,
        BigDecimal ingresosEfectivo,
        BigDecimal egresosEfectivo,
        BigDecimal efectivoEsperado,
        BigDecimal efectivoContado,
        BigDecimal diferencia,      // negativo = faltante, positivo = sobrante
        BigDecimal retiro,
        BigDecimal fondoSiguiente,
        BigDecimal totalIngresos,
        BigDecimal totalEgresos,
        int cantidadCobros,
        int cantidadGastos,
        String observacion,
        String cerradoPor,
        List<TurnoCajaDTO.TotalMetodo> metodos
) {
}
