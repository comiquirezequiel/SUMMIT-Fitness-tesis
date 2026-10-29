package com.summit.backend.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Totales de caja: ingresos de hoy (con el detalle por método de pago) y del mes.
 * Solo cuentan los pagos aprobados; los "a verificar" se informan aparte.
 */
@Builder
public record CajaResumenDTO(
        BigDecimal ingresosHoy,
        long cobrosHoy,
        Map<String, BigDecimal> ingresosHoyPorMetodo,
        BigDecimal ingresosMes,
        long cobrosMes,
        long pendientesVerificar,
        BigDecimal montoPendienteVerificar,
        // Gastos (egresos) no anulados
        BigDecimal egresosHoy,
        long gastosHoy,
        BigDecimal egresosMes
) {
}
