package com.summit.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Alta de personal del gimnasio (ADMIN, RECEPCION o PROFESOR).
 * Los socios se dan de alta con SocioRequestDTO.
 */
public record StaffRequestDTO(
        @NotBlank(message = "El DNI es obligatorio")
        @Size(min = 7, max = 15, message = "El DNI debe tener entre 7 y 15 caracteres")
        @Pattern(regexp = "^[0-9]+$", message = "El DNI solo puede contener números")
        String dni,

        @NotBlank(message = "El nombre completo es obligatorio")
        @Size(min = 3, max = 100, message = "El nombre debe tener entre 3 y 100 caracteres")
        String nombreCompleto,

        @NotBlank(message = "El email es obligatorio")
        @Email(message = "Formato de email inválido")
        String email,

        @NotBlank(message = "La contraseña es obligatoria")
        @Size(min = 6, max = 100, message = "La contraseña debe tener entre 6 y 100 caracteres")
        String password,

        @Size(max = 25, message = "El teléfono no puede exceder 25 caracteres")
        String telefono,

        @NotBlank(message = "El rol es obligatorio (ADMIN, RECEPCION o PROFESOR)")
        String rol
) {
}
