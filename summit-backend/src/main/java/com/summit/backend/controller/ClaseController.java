package com.summit.backend.controller;

import com.summit.backend.model.Clase;
import com.summit.backend.model.ClaseHorario;
import com.summit.backend.service.ClaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller de clases grupales y horarios.
 */
@RestController
@RequestMapping("/api/clases")
@RequiredArgsConstructor
public class ClaseController {

    private final ClaseService claseService;

    @GetMapping
    public ResponseEntity<?> listar() {
        return ResponseEntity.ok(claseService.listar());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> buscarPorId(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(claseService.buscarPorId(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Clase clase) {
        return ResponseEntity.status(HttpStatus.CREATED).body(claseService.crear(clase));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Long id, @RequestBody Clase data) {
        try {
            return ResponseEntity.ok(claseService.actualizar(id, data));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/horarios")
    public ResponseEntity<?> listarHorarios(@PathVariable Long id) {
        return ResponseEntity.ok(claseService.listarHorarios(id));
    }

    @PostMapping("/{id}/horarios")
    public ResponseEntity<?> agregarHorario(@PathVariable Long id,
                                             @RequestBody ClaseHorario horario) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(claseService.agregarHorario(id, horario));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> desactivar(@PathVariable Long id) {
        try {
            claseService.desactivar(id);
            return ResponseEntity.ok(Map.of("mensaje", "Clase desactivada"));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
