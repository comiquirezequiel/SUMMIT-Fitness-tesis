package com.summit.backend.dto;

import com.summit.backend.model.EstadoUsuario;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Builder
public record SocioResponseDTO(
        Long idSocio,
        String dni,
        String nombreCompleto,
        String email,
        String telefono,
        EstadoUsuario estado,
        LocalDateTime fechaCreacion,

        // --- Apto médico (Motor de Validación Ley 5397) ---
        boolean aptoMedicoVigente,
        LocalDate vencimientoApto,

        // --- Membresía ---
        String planActual,
        // Plan de la membresía actual (null = nunca tuvo): se propone al cobrarle
        Long idPlanActual,
        boolean membresiaAlDia,
        LocalDate vencimientoMembresia,
        // Pagó por transferencia o QR y un admin todavía no lo confirmó: no hay que volver a cobrarle
        boolean cobroAVerificar,
        // Último día de un congelamiento que rige hoy (null si no está congelada)
        LocalDate congeladaHasta,
        // Descuento que se le propone en cada cobro (null = sin descuento)
        Long idDescuentoHabitual,
        String descuentoHabitual,

        // --- Perfil ---
        LocalDate fechaNacimiento,
        String genero,
        String domicilio,
        String ciudad,
        String objetivo,
        String observaciones,
        // Versión de la foto (null si no tiene): la imagen se pide a /api/socios/{id}/foto?v=fotoVersion
        Long fotoVersion
) {
}
