package com.summit.backend.dto;

import java.time.LocalDate;

/**
 * Datos fiscales del dueño del gimnasio (Ajustes > Facturación), para ver y guardar. condicionIva: MONOTRIBUTO
 * (Factura C) o RESPONSABLE_INSCRIPTO (Factura B).
 */
public record DatosFiscalesDTO(
        String cuit,
        String razonSocial,
        String condicionIva,
        String ingresosBrutos,
        LocalDate inicioActividades,
        String domicilioComercial,
        Integer puntoVenta,
        Boolean identificarSocio
) {
}
