package com.summit.backend.dto;

import java.util.List;

/**
 * Datos del gimnasio para el panel (para ver y guardar) y para los PDF.
 * logoUrl es la dirección del logo con su versión (null si no hay): el logo se sube aparte y se ignora al guardar.
 * horarios: de lunes a domingo; null al guardar = no se cambian.
 */
public record DatosGimnasioDTO(
        String nombre,
        String direccion,
        String ciudad,
        String telefono,
        String whatsapp,
        String email,
        String instagram,
        String logoUrl,
        List<Horario> horarios) {

    /** Un día de la semana (LUNES ... DOMINGO) con su horario "HH:mm"; abre y cierra en null = ese día no abre. */
    public record Horario(String dia, String abre, String cierra) {
    }
}
