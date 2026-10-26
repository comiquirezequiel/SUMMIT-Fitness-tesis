package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Una tarea de seguimiento con los datos del socio para contactarlo.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TareaDTO {
    private Long idTarea;
    private Long idSocio;
    private String nombreSocio;
    private String dniSocio;
    private String telefonoSocio;
    private String tipo;               // CUOTA_POR_VENCER, CUOTA_VENCIDA, APTO_POR_VENCER, INACTIVO o MANUAL
    private String descripcion;
    private LocalDate vence;
    private LocalDate fechaReferencia; // vencimiento de la cuota o del apto, o el último ingreso
    private String estado;
    private String canal;
    private String nota;
    private String creadaPor;          // null = automática
    private LocalDateTime fechaCreacion;
    private String resueltaPor;
    private LocalDateTime fechaResolucion;
}
