package com.summit.backend.dto;

/**
 * Datos del gimnasio para el panel (para ver y guardar) y para los PDF.
 * logoUrl es la dirección del logo con su versión (null si no hay): el logo se sube aparte y se ignora al guardar.
 */
public record DatosGimnasioDTO(
        String nombre,
        String direccion,
        String ciudad,
        String telefono,
        String whatsapp,
        String email,
        String instagram,
        String logoUrl) {
}
