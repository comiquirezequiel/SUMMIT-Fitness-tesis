package com.summit.backend.dto;

import java.util.List;

/**
 * Resultado de "Probar conexión" con ARCA, paso por paso (se corta en el primero que falla).
 */
public record PruebaConexionDTO(boolean ok, List<Paso> pasos) {

    public record Paso(String nombre, boolean ok, String detalle) {
    }
}
