package com.summit.backend.dto;

import com.summit.backend.model.MotivoCongelamiento;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Pedido de congelamiento: primer y último día congelado (los dos incluidos).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CongelamientoRequestDTO {

    @NotNull(message = "Indicá desde qué día se congela")
    private LocalDate desde;

    @NotNull(message = "Indicá hasta qué día se congela")
    private LocalDate hasta;

    @NotNull(message = "Elegí el motivo")
    private MotivoCongelamiento motivo;

    @Size(max = 200, message = "La observación no puede superar los 200 caracteres")
    private String observacion;
}
