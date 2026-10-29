package com.summit.backend.dto;

import com.summit.backend.model.MotivoCongelamiento;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Pedido de congelamiento: primer y último día congelado (los dos incluidos).
 */
public record CongelamientoRequestDTO(
        @NotNull(message = "Indicá desde qué día se congela")
        LocalDate desde,

        @NotNull(message = "Indicá hasta qué día se congela")
        LocalDate hasta,

        @NotNull(message = "Elegí el motivo")
        MotivoCongelamiento motivo,

        @Size(max = 200, message = "La observación no puede superar los 200 caracteres")
        String observacion
) {
}
