package com.summit.backend.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Una factura o nota de crédito electrónica, con todo lo que va impreso: emisor (tal como era al emitirla), receptor,
 * detalle del cobro, CAE y el link del código QR de ARCA.
 */
@Builder
public record ComprobanteFiscalDTO(
        Long idComprobante,
        Long idPago,
        Long idSocio,
        String nombreSocio,
        String telefonoSocio,

        String tipo,                // FACTURA_C, NOTA_CREDITO_B, ... (null mientras no se envía)
        String letra,               // B o C
        Integer codigoTipo,         // código de ARCA (11, 6, 13, 8)
        String nombreTipo,          // "Factura" o "Nota de crédito"
        boolean notaCredito,
        Integer puntoVenta,
        Long numero,
        String numeroCompleto,      // "00002-00000154"
        LocalDate fecha,

        String estado,              // PENDIENTE, ENVIANDO, INCIERTO, AUTORIZADO o RECHAZADO
        String ambiente,            // SIMULADOR, HOMOLOGACION o PRODUCCION
        boolean deVerdad,           // false = sin validez fiscal (marca de agua en el PDF)

        BigDecimal total,
        BigDecimal neto,
        BigDecimal iva,             // IVA contenido (solo en la B)

        String cae,
        LocalDate caeVencimiento,
        String qrUrl,               // lo que codifica el QR (RG 4892)
        String observaciones,
        String ultimoError,
        int intentos,
        LocalDateTime proximoIntento,
        LocalDateTime creado,
        LocalDateTime autorizado,
        String solicitadoPor,

        // Nota de crédito: por qué y qué factura anula
        String motivo,
        Long idAsociado,
        String asociado,            // "Factura C 00002-00000154"
        // Factura: su nota de crédito, si tiene una que no fue rechazada
        Long idNotaCredito,
        String descripcionNotaCredito,  // "Nota de crédito C 00002-00000012" (o "pendiente")
        String estadoNotaCredito,
        boolean anulada,            // tiene una nota de crédito autorizada

        String emisorCuit,
        String emisorRazonSocial,
        String emisorDomicilio,
        String emisorCondicionIva,  // como va impreso: "Responsable Monotributo"
        String emisorIngresosBrutos,
        LocalDate emisorInicioActividades,

        Integer docTipo,            // 99 = consumidor final sin identificar, 96 = DNI
        Long docNro,
        String receptorNombre,

        LocalDate servicioDesde,
        LocalDate servicioHasta,
        LocalDate vencimientoPago,

        // Detalle del cobro
        LocalDateTime fechaPago,
        String metodoPago,
        String plan,
        BigDecimal precioLista,
        String descuentoNombre,
        BigDecimal descuentoMonto,
        BigDecimal matriculaMonto
) {
}
