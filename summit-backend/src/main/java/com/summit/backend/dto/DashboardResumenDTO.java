package com.summit.backend.dto;

import lombok.Builder;

/**
 * Indicadores del tablero de recepción / gerencia.
 */
@Builder
public record DashboardResumenDTO(
        // Socios
        long sociosTotal,
        long sociosActivos,
        long sociosInactivos,
        long nuevosEsteMes,
        long membresiasPorVencer, // vencen en los próximos 7 días
        // Ingresos (intentos de acceso) de hoy
        long ingresosHoy,
        long permitidosHoy,
        long denegadosHoy,
        long ingresosUltimaHora) {
}
