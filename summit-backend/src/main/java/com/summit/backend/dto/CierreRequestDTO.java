package com.summit.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Cierre de caja: lo que se contó en la caja, lo que se retira y, si hay diferencia, por qué.
 */
public record CierreRequestDTO(
        @NotNull(message = "Indicá cuánto efectivo contaste en la caja")
        BigDecimal efectivoContado,

        // null = no se retira nada (todo queda de fondo para el turno siguiente)
        BigDecimal retiro,

        @Size(max = 300, message = "La observación no puede superar los 300 caracteres")
        String observacion
) {
}
