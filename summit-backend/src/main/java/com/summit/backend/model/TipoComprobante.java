package com.summit.backend.model;

import java.util.Arrays;

/**
 * Comprobantes que emite SUMMIT, con su código de ARCA. Una factura autorizada no se borra: se anula con una nota de
 * crédito de la misma letra.
 */
public enum TipoComprobante {
    FACTURA_B(6, "B", "Factura"),
    NOTA_CREDITO_B(8, "B", "Nota de crédito"),
    FACTURA_C(11, "C", "Factura"),
    NOTA_CREDITO_C(13, "C", "Nota de crédito");

    private final int codigo;
    private final String letra;
    private final String nombre;

    TipoComprobante(int codigo, String letra, String nombre) {
        this.codigo = codigo;
        this.letra = letra;
        this.nombre = nombre;
    }

    public int codigo() {
        return codigo;
    }

    public String letra() {
        return letra;
    }

    public String nombre() {
        return nombre;
    }

    public boolean esNotaCredito() {
        return this == NOTA_CREDITO_B || this == NOTA_CREDITO_C;
    }

    /** En la B se discrimina el IVA contenido; en la C no hay IVA. */
    public boolean llevaIva() {
        return "B".equals(letra);
    }

    /** La nota de crédito que anula esta factura. */
    public TipoComprobante notaCredito() {
        return switch (this) {
            case FACTURA_B -> NOTA_CREDITO_B;
            case FACTURA_C -> NOTA_CREDITO_C;
            default -> throw new IllegalStateException("Una nota de crédito no se anula con otra");
        };
    }

    public static TipoComprobante factura(CondicionIva condicion) {
        return condicion == CondicionIva.MONOTRIBUTO ? FACTURA_C : FACTURA_B;
    }

    public static TipoComprobante deCodigo(int codigo) {
        return Arrays.stream(values()).filter(t -> t.codigo == codigo).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Tipo de comprobante desconocido: " + codigo));
    }
}
