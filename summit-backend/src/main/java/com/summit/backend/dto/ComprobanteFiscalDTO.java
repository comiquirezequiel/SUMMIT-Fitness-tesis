package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Una factura o nota de crédito electrónica, con todo lo que va impreso: emisor (tal como era al emitirla), receptor,
 * detalle del cobro, CAE y el link del código QR de ARCA.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComprobanteFiscalDTO {
    private Long idComprobante;
    private Long idPago;
    private Long idSocio;
    private String nombreSocio;
    private String telefonoSocio;

    private String tipo;                // FACTURA_C, NOTA_CREDITO_B, ... (null mientras no se envía)
    private String letra;               // B o C
    private Integer codigoTipo;         // código de ARCA (11, 6, 13, 8)
    private String nombreTipo;          // "Factura" o "Nota de crédito"
    private boolean notaCredito;
    private Integer puntoVenta;
    private Long numero;
    private String numeroCompleto;      // "00002-00000154"
    private LocalDate fecha;

    private String estado;              // PENDIENTE, ENVIANDO, INCIERTO, AUTORIZADO o RECHAZADO
    private String ambiente;            // SIMULADOR, HOMOLOGACION o PRODUCCION
    private boolean deVerdad;           // false = sin validez fiscal (marca de agua en el PDF)

    private BigDecimal total;
    private BigDecimal neto;
    private BigDecimal iva;             // IVA contenido (solo en la B)

    private String cae;
    private LocalDate caeVencimiento;
    private String qrUrl;               // lo que codifica el QR (RG 4892)
    private String observaciones;
    private String ultimoError;
    private int intentos;
    private LocalDateTime proximoIntento;
    private LocalDateTime creado;
    private LocalDateTime autorizado;
    private String solicitadoPor;

    // Nota de crédito: por qué y qué factura anula
    private String motivo;
    private Long idAsociado;
    private String asociado;            // "Factura C 00002-00000154"
    // Factura: su nota de crédito, si tiene una que no fue rechazada
    private Long idNotaCredito;
    private String descripcionNotaCredito;  // "Nota de crédito C 00002-00000012" (o "pendiente")
    private String estadoNotaCredito;
    private boolean anulada;            // tiene una nota de crédito autorizada

    private String emisorCuit;
    private String emisorRazonSocial;
    private String emisorDomicilio;
    private String emisorCondicionIva;  // como va impreso: "Responsable Monotributo"
    private String emisorIngresosBrutos;
    private LocalDate emisorInicioActividades;

    private Integer docTipo;            // 99 = consumidor final sin identificar, 96 = DNI
    private Long docNro;
    private String receptorNombre;

    private LocalDate servicioDesde;
    private LocalDate servicioHasta;
    private LocalDate vencimientoPago;

    // Detalle del cobro
    private LocalDateTime fechaPago;
    private String metodoPago;
    private String plan;
    private BigDecimal precioLista;
    private String descuentoNombre;
    private BigDecimal descuentoMonto;
    private BigDecimal matriculaMonto;
}
