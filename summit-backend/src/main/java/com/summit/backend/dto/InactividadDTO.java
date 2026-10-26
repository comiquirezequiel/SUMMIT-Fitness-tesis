package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Socios con la cuota al día (o vencida hace poco) que hace días que no vienen, con un resumen por nivel de alerta.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InactividadDTO {

    /**
     * Un socio inactivo. nivel: LEVE (7 a 14 días sin venir), MEDIO (15 a 29) o ALTO (30 o más). Si nunca vino,
     * los días se cuentan desde su alta.
     */
    public record Socio(Long idSocio, String nombreCompleto, String dni, String telefono, String email, String plan,
                        LocalDate vencimientoMembresia, LocalDateTime ultimoIngreso, long diasSinVenir, int ingresos90,
                        double promedioSemanal, String nivel, LocalDateTime ultimoContacto, Long idTareaPendiente) {}

    private int leve;
    private int medio;
    private int alto;
    private int sociosAlDia;     // socios activos con la cuota al día (sin los congelados)
    private int vinieronSemana;  // de esos, cuántos vinieron en los últimos 7 días
    private List<Socio> socios;
}
