package com.summit.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SocioRequestDTO {

    @NotBlank(message = "El DNI es obligatorio")
    @Size(min = 7, max = 15, message = "El DNI debe tener entre 7 y 15 caracteres")
    @Pattern(regexp = "^[0-9]+$", message = "El DNI solo puede contener números")
    private String dni;

    @NotBlank(message = "El nombre completo es obligatorio")
    @Size(min = 3, max = 100, message = "El nombre debe tener entre 3 y 100 caracteres")
    private String nombreCompleto;

    @NotBlank(message = "El email es obligatorio")
    @Email(message = "Formato de email inválido")
    private String email;

    @NotBlank(message = "La contraseña es obligatoria")
    @Size(min = 6, max = 100, message = "La contraseña debe tener entre 6 y 100 caracteres")
    private String password;

    @Size(max = 25, message = "El teléfono no puede exceder 25 caracteres")
    private String telefono;
}
