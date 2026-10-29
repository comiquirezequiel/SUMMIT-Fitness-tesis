package com.summit.backend.dto;

import com.summit.backend.model.TipoDescuento;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Alta o edición de un descuento del catálogo.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DescuentoRequestDTO {

    @NotBlank(message = "Poné un nombre al descuento")
    @Size(min = 2, max = 60, message = "El nombre tiene que tener entre 2 y 60 caracteres")
    private String nombre;

    @NotNull(message = "Elegí si es un porcentaje o un monto fijo")
    private TipoDescuento tipo;

    @NotNull(message = "Indicá el valor del descuento")
    private BigDecimal valor;

    // null = activo
    private Boolean activo;
}
