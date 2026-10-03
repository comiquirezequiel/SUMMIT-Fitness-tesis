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
 */
@RestController
@RequestMapping("/api/ia")
@RequiredArgsConstructor
public class IaController {

    private final AsistenteIaService asistente;

    @GetMapping("/estado")
    public ResponseEntity<OllamaClient.Estado> estado() {
        return ResponseEntity.ok(asistente.estado());
    }

    /**
     * Lee un certificado ANTES de subirlo (alta de socio o carga nueva) para precargar el formulario.
     */
    @PostMapping(value = "/certificados/analizar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> analizarArchivo(@RequestParam(value = "archivo", required = false) MultipartFile archivo) {
        return responder(() -> asistente.analizarArchivo(archivo));
    }

    /**
     * Lee un certificado que ya está en la ficha del socio.
     */
    @PostMapping("/socios/{idSocio}/certificados/{idCertificado}/analizar")
    public ResponseEntity<?> analizarGuardado(@PathVariable Long idSocio, @PathVariable Long idCertificado) {
        return responder(() -> asistente.analizarGuardado(idSocio, idCertificado));
    }

    /**
     * Ejercicios del catálogo que el socio debería evitar (regla firme + sugerencias de la IA).
     */
    @PostMapping("/socios/{idSocio}/ejercicios-a-evitar")
    public ResponseEntity<?> ejerciciosAEvitar(@PathVariable Long idSocio) {
        return responder(() -> asistente.ejerciciosAEvitar(idSocio));
    }

    private static ResponseEntity<?> responder(Supplier<Object> accion) {
        try {
            return ResponseEntity.ok(accion.get());
        } catch (OllamaClient.IaNoDisponibleException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", String.valueOf(e.getMessage())));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", String.valueOf(e.getMessage())));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }
}
