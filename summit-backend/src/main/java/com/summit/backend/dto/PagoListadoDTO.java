package com.summit.backend.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Un cobro para el listado de caja y la ficha del socio (sin exponer las entidades completas).
 */
@Builder(toBuilder = true)
public record PagoListadoDTO(
        Long idPago,
        LocalDateTime fechaPago,
        Long idSocio,
        String nombreSocio,
        String dniSocio,
        String telefonoSocio,   // para mandarle el comprobante por WhatsApp
        String plan,
        BigDecimal monto,
        String metodoPago,
        String comprobante,
        String estado,          // PENDIENTE (a verificar), APROBADO o RECHAZADO
        String registradoPor,   // empleado que cobró (null en los débitos automáticos)
        String verificadoPor,   // quién confirmó o rechazó un pago a verificar
        LocalDateTime fechaVerificacion,

        // Detalle (null en los cobros anteriores al detalle y en los débitos automáticos): monto = precioLista -
        // descuentoMonto + matriculaMonto
        BigDecimal precioLista,
        String descuentoNombre,
        BigDecimal descuentoMonto,
        BigDecimal matriculaMonto, // null = no correspondía; 0 = bonificada
        LocalDate venceMembresia,  // hasta cuándo quedó paga la membresía con este cobro (null si no la extendió)
        FacturaResumenDTO factura // su factura electrónica (null si no tiene o la facturación está apagada)
) {
}
