package com.summit.backend.dto;

import com.summit.backend.model.TipoDescuento;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Alta o edición de un descuento del catálogo.
 */
public record DescuentoRequestDTO(
        @NotBlank(message = "Poné un nombre al descuento")
        @Size(min = 2, max = 60, message = "El nombre tiene que tener entre 2 y 60 caracteres")
        String nombre,

        @NotNull(message = "Elegí si es un porcentaje o un monto fijo")
        TipoDescuento tipo,

        @NotNull(message = "Indicá el valor del descuento")
        BigDecimal valor,

        // null = activo
        Boolean activo
) {
}
