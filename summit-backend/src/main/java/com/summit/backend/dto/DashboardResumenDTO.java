package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Indicadores del tablero de recepción / gerencia.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardResumenDTO {
    // Socios
    private long sociosTotal;
    private long sociosActivos;
    private long sociosInactivos;
    private long nuevosEsteMes;
    private long membresiasPorVencer; // vencen en los próximos 7 días

    // Ingresos (intentos de acceso) de hoy
    private long ingresosHoy;
    private long permitidosHoy;
    private long denegadosHoy;
    private long ingresosUltimaHora;
}
