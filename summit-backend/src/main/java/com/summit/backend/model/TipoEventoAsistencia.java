package com.summit.backend.model;

public enum TipoEventoAsistencia {
    CHECKIN_QR,
    CHECKIN_MANUAL,
    CHECKOUT,
    INGRESO_MOLINETE,
    INGRESO_EXCEPCION // recepción lo dejó pasar con la cuota vencida o sin días del plan (queda quién y por qué)
}
