package com.summit.backend.controller;

import com.summit.backend.dto.DatosGimnasioDTO;
import com.summit.backend.service.DatosGimnasioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.Map;

/**
 * Datos del gimnasio (Ajustes > Datos del gimnasio). Permisos de SecurityConfig: los ven ADMIN, RECEPCION y PROFESOR
 * (para el encabezado del PDF de las rutinas); los cambia solo ADMIN.
 */
@RestController
@RequestMapping("/api/configuracion/gimnasio")
@RequiredArgsConstructor
public class DatosGimnasioController {

    private final DatosGimnasioService datosGimnasioService;

    @GetMapping
    public ResponseEntity<DatosGimnasioDTO> obtener() {
        return ResponseEntity.ok(datosGimnasioService.obtenerDTO());
    }

    @PutMapping
    public ResponseEntity<?> actualizar(@RequestBody(required = false) DatosGimnasioDTO pedido) {
        return ResponseEntity.ok(datosGimnasioService.actualizar(pedido));
    }

    /** Sube el logo (PNG o JPG, máximo 5 MB) y reemplaza el anterior. Devuelve los datos con el logoUrl nuevo. */
    @PostMapping("/logo")
    public ResponseEntity<?> subirLogo(@RequestParam(value = "logo", required = false) MultipartFile logo) {
        return ResponseEntity.ok(datosGimnasioService.guardarLogo(logo));
    }

    /** El logo en PNG (404 si no hay). El panel lo pide con ?v=versión, así un logo nuevo cambia la dirección. */
    @GetMapping("/logo")
    public ResponseEntity<?> logo() {
        return datosGimnasioService.cargarLogo()
                .<ResponseEntity<?>>map(logo -> ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_PNG)
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePrivate())
                        .body(logo.recurso()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "El gimnasio no tiene logo")));
    }

    @DeleteMapping("/logo")
    public ResponseEntity<DatosGimnasioDTO> quitarLogo() {
        return ResponseEntity.ok(datosGimnasioService.eliminarLogo());
    }
}
