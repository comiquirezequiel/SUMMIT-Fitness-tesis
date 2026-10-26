package com.summit.backend.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

/**
 * Fechas en palabras para los avisos de la app ("hoy", "mañana" o "el jueves 30/10") y completas para los mensajes
 * del panel ("30/10/2026").
 */
final class TextoFechas {

    private static final String[] DIAS = {"lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"};
    private static final DateTimeFormatter DIA_MES = DateTimeFormatter.ofPattern("dd/MM");
    private static final DateTimeFormatter COMPLETA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private TextoFechas() {
    }

    static String completa(LocalDate fecha) {
        return fecha.format(COMPLETA);
    }

    static String cuando(LocalDate fecha, LocalDate hoy) {
        long dias = ChronoUnit.DAYS.between(hoy, fecha);
        if (dias == 0) {
            return "hoy";
        }
        if (dias == 1) {
            return "mañana";
        }
        return "el " + DIAS[fecha.getDayOfWeek().getValue() - 1] + " " + fecha.format(DIA_MES);
    }
}
