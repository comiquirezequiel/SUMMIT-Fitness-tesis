package com.summit.backend.dto;

import com.summit.backend.model.EstadoUsuario;
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
public class SocioResponseDTO {
    private Long idSocio;
    private String dni;
    private String nombreCompleto;
    private String email;
    private String telefono;
    private EstadoUsuario estado;
    private LocalDateTime fechaCreacion;

    // --- Apto médico (Motor de Validación Ley 5397) ---
    private boolean aptoMedicoVigente;
    private LocalDate vencimientoApto;

    // --- Membresía ---
    private String planActual;
    private boolean membresiaAlDia;
    private LocalDate vencimientoMembresia;

    // --- Perfil ---
    private LocalDate fechaNacimiento;
    private String genero;
    private String domicilio;
    private String ciudad;
    private String objetivo;
    private String observaciones;
}
