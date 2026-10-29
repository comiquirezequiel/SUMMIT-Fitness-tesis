package com.summit.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record SocioRequestDTO(
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

        @Size(max = 25, message = "El teléfono no puede exceder 25 caracteres")
        String telefono,

        // --- Perfil (opcional) ---
        @Past(message = "La fecha de nacimiento debe ser anterior a hoy")
        LocalDate fechaNacimiento,

        @Size(max = 20, message = "El género no puede exceder 20 caracteres")
        String genero,

        @Size(max = 150, message = "El domicilio no puede exceder 150 caracteres")
        String domicilio,

        @Size(max = 80, message = "La ciudad no puede exceder 80 caracteres")
        String ciudad,

        @Size(max = 150, message = "El objetivo no puede exceder 150 caracteres")
        String objetivo,

        @Size(max = 500, message = "Las observaciones no pueden exceder 500 caracteres")
        String observaciones,

        // Descuento habitual del catálogo (null = sin descuento)
        Long idDescuento
) {
}
