package com.summit.backend.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Importación de socios desde una planilla (Excel o CSV): el panel lee el archivo y manda las filas ya separadas.
 */
public final class ImportacionSociosDTO {

    private ImportacionSociosDTO() {
    }

    /**
     * Una fila de la planilla. numero es el de la fila en el archivo (para los mensajes). plan y vence son opcionales:
     * con los dos, el socio queda con su membresía hasta esa fecha (sin cobro: lo pagó en el sistema anterior).
     */
    public record Fila(Integer numero, String nombreCompleto, String dni, String email, String telefono,
                       LocalDate fechaNacimiento, String genero, String domicilio, String ciudad, String objetivo,
                       String observaciones, String plan, LocalDate vence) {}

    public record Pedido(List<Fila> filas) {}

    /** estado: CREADO, EXISTE (ese DNI ya estaba) o ERROR. aviso: algo que no se pudo cargar (ej. el plan). */
    public record Resultado(Integer numero, String estado, String mensaje, Long idSocio, String aviso) {}
}
