package com.summit.backend.controller;

import com.summit.backend.service.AsistenteIaService;
import com.summit.backend.service.OllamaClient;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Supplier;

/**
 * Asistente de IA local (Ollama) para el personal: lee certificados médicos y sugiere ejercicios a evitar.
 * Todo es una propuesta: nada se guarda hasta que el personal lo confirma en la ficha del socio.
 * Si Ollama no está corriendo responde 503 y el resto del sistema sigue funcionando.
 *
 * <p><b>Rol en la arquitectura:</b> es la "puerta de entrada" HTTP (capa Controller). Recibe los pedidos del
 * frontend, delega TODO el trabajo en {@link AsistenteIaService} y traduce los resultados y errores a
 * respuestas HTTP. No contiene lógica de negocio.</p>
 *
 * <p><b>Seguridad:</b> SecurityConfig restringe /api/ia/** a ADMIN, RECEPCION y PROFESOR: un socio recibe 403.
 * Además el pedido debe traer un token JWT válido (si no, 401).</p>
 */
// @RestController: las respuestas de los métodos se convierten automáticamente a JSON.
@RestController
// Todas las rutas de esta clase empiezan con /api/ia
@RequestMapping("/api/ia")
@RequiredArgsConstructor
public class IaController {

    private final AsistenteIaService asistente;

    /**
     * GET /api/ia/estado → {"disponible": true, "modelo": "gemma4:12b", "motivo": null}
     * La página lo consulta para habilitar o deshabilitar los botones de IA y explicar por qué.
     */
    @GetMapping("/estado")
    public ResponseEntity<OllamaClient.Estado> estado() {
        return ResponseEntity.ok(asistente.estado());
    }

    /**
     * Lee un certificado ANTES de subirlo (alta de socio o carga nueva) para precargar el formulario.
     *
     * <p>POST /api/ia/certificados/analizar con formato multipart/form-data (el formato de los formularios con
     * archivos): campo "archivo" (el PDF o la imagen) y "dni" opcional (DNI del socio, para detectar si el
     * certificado es de otra persona). Se declaran required=false para validar en el servicio y responder
     * un mensaje en español en lugar del error genérico de Spring.</p>
     */
    @PostMapping(value = "/certificados/analizar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> analizarArchivo(@RequestParam(value = "archivo", required = false) MultipartFile archivo,
                                             @RequestParam(value = "dni", required = false) String dni) {
        return responder(() -> asistente.analizarArchivo(archivo, dni));
    }

    /**
     * Lee un certificado que ya está en la ficha del socio.
     * POST /api/ia/socios/{idSocio}/certificados/{idCertificado}/analizar
     * (POST y no GET porque es una operación costosa que no debe dispararse sola, por ejemplo por un precargado del navegador).
     */
    @PostMapping("/socios/{idSocio}/certificados/{idCertificado}/analizar")
    public ResponseEntity<?> analizarGuardado(@PathVariable Long idSocio, @PathVariable Long idCertificado) {
        return responder(() -> asistente.analizarGuardado(idSocio, idCertificado));
    }

    /**
     * Ejercicios del catálogo que el socio debería evitar (regla firme + sugerencias de la IA).
     * POST /api/ia/socios/{idSocio}/ejercicios-a-evitar
     */
    @PostMapping("/socios/{idSocio}/ejercicios-a-evitar")
    public ResponseEntity<?> ejerciciosAEvitar(@PathVariable Long idSocio) {
        return responder(() -> asistente.ejerciciosAEvitar(idSocio));
    }

    /**
     * Ejecuta la acción y traduce los errores a respuestas HTTP con el formato {"error": "..."}
     * que ya usa todo el frontend. Se centraliza acá para no repetir el mismo try/catch en cada endpoint.
     *
     * <p>Supplier = una función sin parámetros que devuelve un resultado: se le pasa "qué hacer"
     * (por ejemplo () -> asistente.ejerciciosAEvitar(idSocio)) y este método lo ejecuta.</p>
     */
    private static ResponseEntity<?> responder(Supplier<Object> accion) {
        try {
            return ResponseEntity.ok(accion.get());   // 200 con el resultado en JSON
        } catch (OllamaClient.IaNoDisponibleException e) {
            // 503 Service Unavailable: la IA no está (Ollama apagado, ocupado o demorado). No es culpa del usuario.
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", String.valueOf(e.getMessage())));
        } catch (NoSuchElementException e) {
            // 404 Not Found: el socio o el certificado no existen.
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", String.valueOf(e.getMessage())));
        } catch (IllegalArgumentException | IllegalStateException e) {
            // 400 Bad Request: datos inválidos (archivo que no es PDF/imagen, socio sin patologías, etc.).
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
        // Cualquier otro error inesperado sigue de largo y lo atiende GlobalExceptionHandler.
    }
}
