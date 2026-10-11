package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Un cobro para el listado de caja y la ficha del socio (sin exponer las entidades completas).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PagoListadoDTO {
    private Long idPago;
    private LocalDateTime fechaPago;
    private Long idSocio;
    private String nombreSocio;
    private String dniSocio;
    private String plan;
    private BigDecimal monto;
    private String metodoPago;
    private String comprobante;
    private String estado;          // PENDIENTE (a verificar), APROBADO o RECHAZADO
    private String registradoPor;   // empleado que cobró (null en los débitos automáticos)
    private String verificadoPor;   // quién confirmó o rechazó un pago a verificar
    private LocalDateTime fechaVerificacion;
}
