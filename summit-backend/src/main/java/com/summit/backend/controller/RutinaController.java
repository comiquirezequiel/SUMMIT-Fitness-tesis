package com.summit.backend.controller;

import com.summit.backend.model.Rutina;
import com.summit.backend.model.RutinaEjercicio;
import com.summit.backend.service.RutinaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller de rutinas de entrenamiento.
 */
@RestController
@RequestMapping("/api/rutinas")
@RequiredArgsConstructor
public class RutinaController {

    private final RutinaService rutinaService;

    @GetMapping("/socio/{idSocio}")
    public ResponseEntity<?> listarPorSocio(@PathVariable Long idSocio) {
        return ResponseEntity.ok(rutinaService.listarPorSocio(idSocio));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> buscarPorId(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(rutinaService.buscarPorId(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Rutina rutina) {
        return ResponseEntity.status(HttpStatus.CREATED).body(rutinaService.crear(rutina));
    }

    @GetMapping("/validar-ejercicio")
    public ResponseEntity<?> validarEjercicio(
            @RequestParam Long idSocio,
            @RequestParam Long idEjercicio) {
        try {
            java.util.List<String> riesgos = rutinaService.validarEjercicioContraindicado(idSocio, idEjercicio);
            return ResponseEntity.ok(Map.of("contraindicado", !riesgos.isEmpty(), "riesgos", riesgos));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/ejercicios")
    public ResponseEntity<?> agregarEjercicio(  
            @PathVariable Long id,
            @RequestBody RutinaEjercicio rutinaEjercicio,
            @RequestParam(required = false, defaultValue = "false") boolean forzar) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(rutinaService.agregarEjercicio(id, rutinaEjercicio, forzar));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> desactivar(@PathVariable Long id) {
        try {
            rutinaService.desactivar(id);
            return ResponseEntity.ok(Map.of("mensaje", "Rutina desactivada"));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
