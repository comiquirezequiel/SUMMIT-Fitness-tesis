package com.summit.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckInResponse {

    private boolean permitido;
    private String resultado;   // "PERMITIDO", "DENEGADO_CUOTA_VENCIDA", etc.
    private String mensaje;     // Mensaje legible para el usuario
    private Double distanciaMetros;
    private String fechaHora;
    private String nombreSocio;
}
