package com.summit.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalTime;
import java.util.List;

/**
 * Datos del gimnasio para el panel (para ver y guardar) y para la app del socio.
 * latitud y longitud salen de Reglas de acceso (la ubicación del ingreso con QR): sirven para el botón del mapa.
 * Se ignoran al guardar.
 */
public record DatosGimnasioDTO(
        String nombre,
        String direccion,
        String ciudad,
        String telefono,
        String whatsapp,
        String email,
        String instagram,
        String reglamento,
        Integer capacidad,
        List<Horario> horarios,
        Double latitud,
        Double longitud) {

    /** dia: LUNES a DOMINGO. Sin "abre", ese día está cerrado. Las horas van como "07:00". */
    public record Horario(String dia,
                          @JsonFormat(pattern = "HH:mm") LocalTime abre,
                          @JsonFormat(pattern = "HH:mm") LocalTime cierra) {
    }
}
