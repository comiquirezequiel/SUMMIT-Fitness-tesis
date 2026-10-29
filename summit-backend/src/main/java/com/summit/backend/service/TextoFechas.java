package com.summit.backend.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Fechas completas para los mensajes del panel ("30/10/2026").
 */
final class TextoFechas {

    private static final DateTimeFormatter COMPLETA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private TextoFechas() {
    }

    static String completa(LocalDate fecha) {
        return fecha.format(COMPLETA);
    }
}
