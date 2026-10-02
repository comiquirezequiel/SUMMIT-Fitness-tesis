package com.summit.backend.config;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.summit.backend.controller.EjercicioController;
import com.summit.backend.controller.EntrenamientoController;
import com.summit.backend.controller.RutinaController;
import com.summit.backend.service.RutinaService;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Errores de rutinas, ejercicios y entrenamientos con el formato {"error": "..."} del frontend:
 * 404 si lo pedido no existe y 400 si los datos no son válidos, con mensajes en castellano
 * (el socio los ve en el celular). Solo para estos controllers; tiene prioridad sobre GlobalExceptionHandler.
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

    // JSON mal formado o con un dato de otro tipo (ej. "42,5" en un número)
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> jsonInvalido(HttpMessageNotReadableException e) {
        if (e.getCause() instanceof JsonMappingException mapeo && !mapeo.getPath().isEmpty()) {
            String campo = mapeo.getPath().get(mapeo.getPath().size() - 1).getFieldName();
            if (campo != null) {
                return error(HttpStatus.BAD_REQUEST, "El campo " + campo + " tiene un formato inválido");
            }
        }
        return error(HttpStatus.BAD_REQUEST, "Faltan los datos o no tienen formato JSON");
    }

    // Parámetro de la URL con un tipo inválido (ej. ?dia=abc o una fecha mal escrita)
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> parametroInvalido(MethodArgumentTypeMismatchException e) {
        return error(HttpStatus.BAD_REQUEST, "El parámetro " + e.getName() + " tiene un formato inválido");
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> datosInvalidos(RuntimeException e) {
        return error(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus estado, String mensaje) {
        return ResponseEntity.status(estado).body(Map.of("error", String.valueOf(mensaje)));
    }
}
