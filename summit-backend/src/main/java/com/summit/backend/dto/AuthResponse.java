package com.summit.backend.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthResponse {

    private String token;

    @Builder.Default
    private String tipo = "Bearer";

    private Long idUsuario;
    private String email;
    private String nombreCompleto;
    private String rol;

    // Solo socios: hasta cuándo la app puede renovar el token sola sin pedir la contraseña (se corre con cada uso).
    // El personal no tiene sesión renovable: null.
    private LocalDateTime renovableHasta;

    // Entró con una contraseña temporal: antes de seguir tiene que elegir una propia
    private boolean debeCambiarPassword;
}
