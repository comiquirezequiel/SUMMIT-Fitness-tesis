package com.summit.backend.dto;

import com.summit.backend.model.CategoriaGasto;
import com.summit.backend.model.MetodoPago;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Alta de un gasto de la caja.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GastoRequestDTO {

    @NotNull(message = "Indicá el monto")
    private BigDecimal monto;

    @NotNull(message = "Elegí el rubro")
    private CategoriaGasto categoria;

    @NotBlank(message = "Escribí en qué se gastó")
    @Size(min = 3, max = 200, message = "La descripción tiene que tener entre 3 y 200 caracteres")
    private String descripcion;

    @NotNull(message = "Elegí cómo se pagó")
    private MetodoPago metodoPago;

    // Solo en efectivo: lo pagó el dueño con su plata, no salió de la caja (no se descuenta en el arqueo)
    private boolean fueraDeCaja;

    @Size(max = 50, message = "El número de comprobante no puede superar los 50 caracteres")
    private String comprobante;
}
