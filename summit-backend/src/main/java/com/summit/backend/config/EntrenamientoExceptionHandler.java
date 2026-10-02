package com.summit.backend.config;

import com.summit.backend.controller.EjercicioController;
import com.summit.backend.controller.EntrenamientoController;
import com.summit.backend.controller.RutinaController;
import com.summit.backend.service.RutinaService;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Errores propios de rutinas, ejercicios y entrenamientos: el riesgo de lesión (con la lista de riesgos)
 * y el 404 cuando lo pedido no existe. Solo para estos controllers y con prioridad; el resto de los errores
 * (formato de datos, parámetros, validaciones) los resuelve GlobalExceptionHandler.
 */
@RestControllerAdvice(assignableTypes = {RutinaController.class, EjercicioController.class, EntrenamientoController.class})
@Order(Ordered.HIGHEST_PRECEDENCE)
public class EntrenamientoExceptionHandler {

    // Ejercicio contraindicado para el socio: con la lista de riesgos el frontend puede ofrecer forzarlo
    @ExceptionHandler(RutinaService.RiesgoLesionException.class)
    public ResponseEntity<Map<String, Object>> riesgoDeLesion(RutinaService.RiesgoLesionException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage(), "riesgos", e.getRiesgos()));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> noEncontrado(NoSuchElementException e) {
        return error(HttpStatus.NOT_FOUND, e.getMessage());
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus estado, String mensaje) {
        return ResponseEntity.status(estado).body(Map.of("error", String.valueOf(mensaje)));
    }
}
