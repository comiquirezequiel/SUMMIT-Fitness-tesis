package com.summit.backend.dto;

import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Resultado de un intento de ingreso: es lo que ve el recepcionista en su monitor.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckInResponse {

    private boolean permitido;
    private String resultado;   // "PERMITIDO", "DENEGADO_CUOTA_VENCIDA", etc. (el primer motivo de rechazo)
    private String mensaje;     // Mensaje legible para el usuario
    private Double distanciaMetros;
    private String fechaHora;
    private String nombreSocio;

    // --- Ficha que se muestra en recepción ---
    private String dni;
    private String rol;
    private String plan;

    @Builder.Default
    private List<String> faltas = new ArrayList<>();  // motivos que bloquean el ingreso
    @Builder.Default
    private List<String> avisos = new ArrayList<>();  // advertencias que no bloquean

    // Días de la semana (lunes a domingo). Permitidos null = pase libre
    private Integer diasSemanaPermitidos;
    private Integer diasSemanaUsados;
    private Integer diasSemanaRestantes;

    // Vencimientos: los "días para vencer" son negativos si ya venció
    private LocalDate vencimientoCuota;
    private Long diasParaVencerCuota;
    private LocalDate vencimientoApto;
    private Long diasParaVencerApto;
    // true si recepción puede dejarlo pasar por excepción (solo cuota vencida o límite semanal; nunca el apto médico)
    private boolean excepcionPosible;
}
