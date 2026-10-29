package com.summit.backend.controller;

import com.summit.backend.service.ArchivoService;
import com.summit.backend.service.FotoSocioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Foto del socio, para que recepción vea quién entra.
 * Permisos de SecurityConfig para /api/socios/**: la sacan o quitan ADMIN y RECEPCION; la ve también PROFESOR.
 */
@RestController
@RequestMapping("/api/socios/{idSocio}/foto")
@RequiredArgsConstructor
public class FotoSocioController {

    private final FotoSocioService fotoSocioService;

    /**
     * Guarda la foto (JPG o PNG, máximo 5 MB) y reemplaza la anterior. Devuelve {"fotoVersion": ...}.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> guardar(@PathVariable Long idSocio,
                                     @RequestParam(value = "foto", required = false) MultipartFile foto) {
        try {
            return ResponseEntity.ok(Map.of("fotoVersion", fotoSocioService.guardar(idSocio, foto)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    /**
     * La foto en JPG. El panel la pide con ?v=versión: con una foto nueva cambia la dirección, así que el navegador
     * la puede guardar un día sin volver a pedirla.
     */
    @GetMapping
    public ResponseEntity<?> ver(@PathVariable Long idSocio) {
        return respuestaFoto(() -> fotoSocioService.cargar(idSocio));
    }

    @DeleteMapping
    public ResponseEntity<?> eliminar(@PathVariable Long idSocio) {
        try {
            fotoSocioService.eliminar(idSocio);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    /**
     * Respuesta con la imagen, o 404 si no hay foto (o el archivo ya no está).
     * "private": la guarda solo el navegador de quien la pidió, nunca un intermediario (Cloudflare).
     */
    static ResponseEntity<?> respuestaFoto(Supplier<Optional<ArchivoService.Archivo>> buscar) {
        try {
            return buscar.get()
                    .<ResponseEntity<?>>map(foto -> ResponseEntity.ok()
                            .contentType(MediaType.IMAGE_JPEG)
                            .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePrivate())
                            .body(foto.recurso()))
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "No tiene foto")));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }
}
