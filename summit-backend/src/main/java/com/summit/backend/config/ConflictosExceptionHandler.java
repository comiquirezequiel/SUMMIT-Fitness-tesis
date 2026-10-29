package com.summit.backend.config;

import com.summit.backend.controller.AsistenciaController;
import com.summit.backend.controller.AsistenciaPersonalController;
import com.summit.backend.controller.CajaController;
import com.summit.backend.controller.CertificadoMedicoController;
import com.summit.backend.controller.CongelamientoController;
import com.summit.backend.controller.DebitoAutomaticoController;
import com.summit.backend.controller.FacturacionController;
import com.summit.backend.controller.MembresiaConfigController;
import com.summit.backend.controller.SeguimientoController;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * En estos controllers, lo que choca con el estado actual (ej. un congelamiento que se superpone, una caja que otra
 * persona acaba de cerrar o un turno ya anulado) es 409 en lugar de 400. El resto de los errores los resuelve
 * GlobalExceptionHandler.
 */
@RestControllerAdvice(assignableTypes = {MembresiaConfigController.class, CongelamientoController.class, CajaController.class,
        SeguimientoController.class, FacturacionController.class, AsistenciaController.class,
        AsistenciaPersonalController.class, CertificadoMedicoController.class, DebitoAutomaticoController.class})
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ConflictosExceptionHandler {

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> conflicto(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", String.valueOf(e.getMessage())));
    }
}
