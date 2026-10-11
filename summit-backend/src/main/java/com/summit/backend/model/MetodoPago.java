package com.summit.backend.model;

public enum MetodoPago {
    EFECTIVO,
    TRANSFERENCIA,
    MERCADO_PAGO, // en pantalla: "QR / billetera" (el QR del gimnasio se paga desde cualquier billetera o banco)
    TARJETA_DEBITO,
    TARJETA_CREDITO,
    DEBITO_AUTOMATICO // cobro mensual de Mercado Pago: lo registra el sistema solo, nunca recepción
}
