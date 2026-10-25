package com.summit.backend.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

/**
 * Fechas en palabras para los avisos de la app: "hoy", "mañana" o "el jueves 30/10".
 */
final class TextoFechas {

    private static final String[] DIAS = {"lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"};
    private static final DateTimeFormatter DIA_MES = DateTimeFormatter.ofPattern("dd/MM");

    private TextoFechas() {
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
