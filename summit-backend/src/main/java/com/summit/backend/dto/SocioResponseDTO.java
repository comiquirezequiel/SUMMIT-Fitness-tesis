package com.summit.backend.dto;

import com.summit.backend.model.EstadoUsuario;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    private boolean aptoMedicoVigente; // Motor de Validación Ley 5397
    
    // --- Membresía ---
    private String planActual;
    private boolean membresiaAlDia;
    private java.time.LocalDate vencimientoMembresia;
}
