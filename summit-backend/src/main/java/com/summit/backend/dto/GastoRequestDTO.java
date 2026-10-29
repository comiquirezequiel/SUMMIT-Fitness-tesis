package com.summit.backend.dto;

import com.summit.backend.model.CategoriaGasto;
import com.summit.backend.model.MetodoPago;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Alta de un gasto de la caja.
 */
public record GastoRequestDTO(
        @NotNull(message = "Indicá el monto")
        BigDecimal monto,

        @NotNull(message = "Elegí el rubro")
        CategoriaGasto categoria,

        @NotBlank(message = "Escribí en qué se gastó")
        @Size(min = 3, max = 200, message = "La descripción tiene que tener entre 3 y 200 caracteres")
        String descripcion,

        @NotNull(message = "Elegí cómo se pagó")
        MetodoPago metodoPago,

        // Solo en efectivo: lo pagó el dueño con su plata, no salió de la caja (no se descuenta en el arqueo)
        boolean fueraDeCaja,

        @Size(max = 50, message = "El número de comprobante no puede superar los 50 caracteres")
        String comprobante
) {
}
