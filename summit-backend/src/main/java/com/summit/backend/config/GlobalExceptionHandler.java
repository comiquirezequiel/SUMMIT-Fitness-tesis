package com.summit.backend.config;

import com.summit.backend.service.CobroConTarjetaService;
import com.summit.backend.service.MercadoPagoClient;
import com.summit.backend.service.OllamaClient;
import com.summit.backend.service.PagoService;
import com.summit.backend.service.PasswordService;
import com.summit.backend.service.RutinaService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import tools.jackson.databind.DatabindException;

import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Manejador global de excepciones: el único lugar que traduce los errores a códigos HTTP, así los controllers no
 * repiten try/catch. Los servicios avisan con el tipo de excepción:
 * <ul>
 *   <li>IllegalArgumentException: datos inválidos → 400 con el mensaje, que está escrito para el usuario.</li>
 *   <li>NoSuchElementException: no existe → 404.</li>
 *   <li>IllegalStateException: choca con el estado actual → 400 (409 en los controllers de ConflictosExceptionHandler).</li>
 *   <li>Cualquier otra: es un error del sistema → 500 con un mensaje genérico; el detalle va solo al registro, para no
 *       mostrar datos internos (SQL, clases, rutas) a quien la provoque.</li>
 * </ul>
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> datosInvalidos(IllegalArgumentException ex) {
        String mensaje = ex.getMessage();
        // Enum.valueOf y Long.valueOf con un texto que no corresponde: su mensaje habla de clases de Java
        if (ex instanceof NumberFormatException) {
            mensaje = "Algún número tiene un formato inválido";
        } else if (mensaje != null && mensaje.startsWith("No enum constant")) {
            mensaje = "El valor " + mensaje.substring(mensaje.lastIndexOf('.') + 1) + " no es válido";
        }
        return error(HttpStatus.BAD_REQUEST, mensaje);
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> noEncontrado(NoSuchElementException ex) {
        return error(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> estadoInvalido(IllegalStateException ex) {
        return error(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    // Fecha con formato inválido en un pedido (ej. LocalDate.parse("hola"))
    @ExceptionHandler(DateTimeException.class)
    public ResponseEntity<Map<String, Object>> fechaInvalida(DateTimeException ex) {
        return error(HttpStatus.BAD_REQUEST, "Alguna fecha tiene un formato inválido");
    }

    // Login: credenciales inválidas o cuenta que no está activa (el mensaje lo arma AuthService)
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> credencialesInvalidas(BadCredentialsException ex) {
        return error(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> sinPermiso(AccessDeniedException ex) {
        return error(HttpStatus.FORBIDDEN, "No tienes permisos para acceder a este recurso");
    }

    // Cambió un precio mientras recepción cobraba: el frontend recalcula y muestra el total nuevo
    @ExceptionHandler(PagoService.TotalCambiadoException.class)
    public ResponseEntity<Map<String, Object>> totalCambiado(PagoService.TotalCambiadoException ex) {
        return error(HttpStatus.CONFLICT, ex.getMessage());
    }

    // El frontend pide otra clave de idempotencia para reintentar con otra tarjeta
    @ExceptionHandler(CobroConTarjetaService.TarjetaRechazadaException.class)
    public ResponseEntity<Map<String, Object>> tarjetaRechazada(CobroConTarjetaService.TarjetaRechazadaException ex) {
        return error(HttpStatus.PAYMENT_REQUIRED, ex.getMessage(), "codigo", "TARJETA_RECHAZADA");
    }

    // Ejercicio contraindicado para el socio: con la lista de riesgos el frontend puede ofrecer forzarlo
    @ExceptionHandler(RutinaService.RiesgoLesionException.class)
    public ResponseEntity<Map<String, Object>> riesgoDeLesion(RutinaService.RiesgoLesionException ex) {
        return error(HttpStatus.BAD_REQUEST, ex.getMessage(), "riesgos", ex.getRiesgos());
    }

    @ExceptionHandler(PasswordService.LinkInvalidoException.class)
    public ResponseEntity<Map<String, Object>> linkInvalido(PasswordService.LinkInvalidoException ex) {
        return error(HttpStatus.BAD_REQUEST, ex.getMessage(), "codigo", "LINK_INVALIDO");
    }

    // Servicios externos u opcionales que no están (Mercado Pago, Ollama, el correo): el resto del sistema sigue
    // funcionando y no es culpa del usuario
    @ExceptionHandler({MercadoPagoClient.MercadoPagoNoDisponibleException.class, OllamaClient.IaNoDisponibleException.class,
            PasswordService.RecuperacionNoDisponibleException.class})
    public ResponseEntity<Map<String, Object>> servicioNoDisponible(RuntimeException ex) {
        return error(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> archivoGrande(MaxUploadSizeExceededException ex) {
        return error(HttpStatus.BAD_REQUEST, "El archivo supera el tamaño máximo de 5 MB");
    }

    // Parámetro con formato inválido (ej. ?fecha=hola o un id con letras)
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> parametroInvalido(MethodArgumentTypeMismatchException ex) {
        return error(HttpStatus.BAD_REQUEST, "El parámetro " + ex.getName() + " tiene un formato inválido");
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> parametroFaltante(MissingServletRequestParameterException ex) {
        return error(HttpStatus.BAD_REQUEST, "Falta el parámetro '" + ex.getParameterName() + "'");
    }

    // JSON mal formado o con un dato de otro tipo (ej. "42,5" en un número): si se sabe, se nombra el campo
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> cuerpoInvalido(HttpMessageNotReadableException ex) {
        if (ex.getCause() instanceof DatabindException mapeo && !mapeo.getPath().isEmpty()) {
            String campo = mapeo.getPath().get(mapeo.getPath().size() - 1).getPropertyName();
            if (campo != null) {
                return error(HttpStatus.BAD_REQUEST, "El campo " + campo + " tiene un formato inválido");
            }
        }
        return error(HttpStatus.BAD_REQUEST, "Faltan los datos o no tienen formato JSON");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> rutaInexistente(NoResourceFoundException ex) {
        return error(HttpStatus.NOT_FOUND, "No existe el recurso pedido");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> metodoNoSoportado(HttpRequestMethodNotSupportedException ex) {
        return error(HttpStatus.METHOD_NOT_ALLOWED, "La operación " + ex.getMethod() + " no está permitida en esta ruta");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> validacion(MethodArgumentNotValidException ex) {
        Map<String, String> errores = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(e -> errores.put(((FieldError) e).getField(), e.getDefaultMessage()));
        return error(HttpStatus.BAD_REQUEST, "Error de validación de datos", "detalles", errores);
    }

    // Error del sistema (base de datos, archivo, un bug): el detalle queda en el registro y no sale en la respuesta
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> errorInterno(Exception ex) {
        log.error("Error no previsto atendiendo un pedido", ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Ocurrió un error interno en el servidor");
    }

    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String mensaje, Object... extra) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", status.value());
        body.put("error", String.valueOf(mensaje));
        for (int i = 0; i < extra.length; i += 2) {
            body.put((String) extra[i], extra[i + 1]);
        }
        return new ResponseEntity<>(body, status);
    }
}
