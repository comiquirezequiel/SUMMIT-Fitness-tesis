package com.summit.backend.dto;

/**
 * Cobro con tarjeta: el cobro de siempre (socio, plan, descuento, matrícula y el total que vio recepción) y lo que
 * devolvió el formulario de tarjeta de Mercado Pago. idempotencia: una clave por intento, así un pedido repetido (por
 * un corte de conexión) no cobra dos veces.
 */
public record CobroConTarjetaDTO(CobroRequestDTO cobro, Tarjeta tarjeta, String idempotencia) {

    /** token: la tarjeta tokenizada por Mercado Pago; medio: visa, master, debvisa...; emisor: el banco. */
    public record Tarjeta(String token, String medio, String emisor, Integer cuotas, String email,
                          String tipoDocumento, String documento) {
    }
}
