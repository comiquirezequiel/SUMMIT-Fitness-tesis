package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Totales de caja: ingresos de hoy (con el detalle por método de pago) y del mes.
 * Solo cuentan los pagos aprobados; los "a verificar" se informan aparte.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CajaResumenDTO {
    private BigDecimal ingresosHoy;
    private long cobrosHoy;
    private Map<String, BigDecimal> ingresosHoyPorMetodo;
    private BigDecimal ingresosMes;
    private long cobrosMes;
    private long pendientesVerificar;
    private BigDecimal montoPendienteVerificar;
}
