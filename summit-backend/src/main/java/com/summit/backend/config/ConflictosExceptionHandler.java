package com.summit.backend.config;

import com.summit.backend.controller.CajaController;
import com.summit.backend.controller.CongelamientoController;
import com.summit.backend.controller.MembresiaConfigController;
import com.summit.backend.controller.SeguimientoController;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Errores de descuentos, reglas de membresía, congelamientos y caja: lo que no existe es 404 y lo que choca con el
 * estado actual (ej. un congelamiento que se superpone, o una caja que otra persona acaba de cerrar) es 409. Los datos
 * inválidos siguen en GlobalExceptionHandler (400).
 */
@RestControllerAdvice(assignableTypes = {MembresiaConfigController.class, CongelamientoController.class, CajaController.class,
        SeguimientoController.class})
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ConflictosExceptionHandler {

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> noEncontrado(NoSuchElementException e) {
        return error(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> conflicto(IllegalStateException e) {
        return error(HttpStatus.CONFLICT, e.getMessage());
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus estado, String mensaje) {
        return ResponseEntity.status(estado).body(Map.of("error", String.valueOf(mensaje)));
    }
}
