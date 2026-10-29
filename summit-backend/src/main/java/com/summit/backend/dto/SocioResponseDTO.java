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
    // Plan de la membresía actual (null = nunca tuvo): se propone al cobrarle
    private Long idPlanActual;
    private boolean membresiaAlDia;
    private LocalDate vencimientoMembresia;
    // Pagó por transferencia o QR y un admin todavía no lo confirmó: no hay que volver a cobrarle
    private boolean cobroAVerificar;
    // Último día de un congelamiento que rige hoy (null si no está congelada)
    private LocalDate congeladaHasta;
    // Descuento que se le propone en cada cobro (null = sin descuento)
    private Long idDescuentoHabitual;
    private String descuentoHabitual;

    // --- Perfil ---
    private LocalDate fechaNacimiento;
    private String genero;
    private String domicilio;
    private String ciudad;
    private String objetivo;
    private String observaciones;
    // Versión de la foto (null si no tiene): la imagen se pide a /api/socios/{id}/foto?v=fotoVersion
    private Long fotoVersion;
}
