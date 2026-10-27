package com.summit.backend.dto;

/**
 * La factura de un cobro, para el listado de la caja: estado, letra, número y si está anulada con nota de crédito.
 */
public record FacturaResumenDTO(Long idComprobante, String estado, String letra, String numero, boolean anulada) {
}
