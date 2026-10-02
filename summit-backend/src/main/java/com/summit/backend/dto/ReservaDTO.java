package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReservaDTO {
    private Long idReserva;
    private Long idHorario;
    private Long idSocio;
    private String nombreSocio;
    private String dni;
    private LocalDate fechaClase;
    private LocalDateTime fechaReserva;
    private String estado;
}
