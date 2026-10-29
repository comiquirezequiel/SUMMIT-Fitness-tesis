package com.summit.backend.service;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/**
 * Montos en pesos para los mensajes: "$ 23.500" o "$ 23.500,50" (como formatMoneda en el frontend).
 */
final class TextoMontos {

    private static final DecimalFormatSymbols SIMBOLOS = DecimalFormatSymbols.getInstance(Locale.forLanguageTag("es-AR"));

    private TextoMontos() {
    }

    static String pesos(BigDecimal monto) {
        boolean conCentavos = monto.stripTrailingZeros().scale() > 0;
        // DecimalFormat no es thread-safe: uno nuevo por llamada
        return "$ " + new DecimalFormat(conCentavos ? "#,##0.00" : "#,##0", SIMBOLOS).format(monto);
    }
}
