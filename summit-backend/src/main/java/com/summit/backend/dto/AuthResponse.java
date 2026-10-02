package com.summit.backend.dto;

import lombok.*;

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
}
