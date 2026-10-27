package com.summit.backend.model;

/**
 * Condición frente al IVA del dueño del gimnasio: define la letra de sus facturas.
 */
public enum CondicionIva {
    MONOTRIBUTO("Responsable Monotributo"),               // Factura C: no discrimina IVA
    RESPONSABLE_INSCRIPTO("IVA Responsable Inscripto");   // Factura B al consumidor final, con el IVA contenido

    private final String texto;

    CondicionIva(String texto) {
        this.texto = texto;
    }

    /** Como va impreso en la factura. */
    public String texto() {
        return texto;
    }
}
