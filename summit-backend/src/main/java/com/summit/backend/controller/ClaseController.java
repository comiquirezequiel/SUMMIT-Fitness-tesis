package com.summit.backend.controller;

import com.summit.backend.model.Clase;
import com.summit.backend.model.ClaseHorario;
import com.summit.backend.service.ClaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Controller de clases grupales y horarios.
 */
@RestController
@RequestMapping("/api/clases")
@RequiredArgsConstructor
public class ClaseController {

    private final ClaseService claseService;

    /**
     * Agenda de un día: horarios de las clases activas con las reservas de esa fecha.
     */
    @GetMapping("/agenda")
    public ResponseEntity<?> agenda(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
        return ResponseEntity.ok(claseService.agenda(fecha));
    }

    @GetMapping
    public ResponseEntity<?> listar() {
        return ResponseEntity.ok(claseService.listar());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(claseService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Clase clase) {
        return ResponseEntity.status(HttpStatus.CREATED).body(claseService.crear(clase));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Long id, @RequestBody Clase data) {
        return ResponseEntity.ok(claseService.actualizar(id, data));
    }

    @GetMapping("/{id}/horarios")
    public ResponseEntity<?> listarHorarios(@PathVariable Long id) {
        return ResponseEntity.ok(claseService.listarHorarios(id));
    }

    @PostMapping("/{id}/horarios")
    public ResponseEntity<?> agregarHorario(@PathVariable Long id,
                                             @RequestBody ClaseHorario horario) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(claseService.agregarHorario(id, horario));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> desactivar(@PathVariable Long id) {
        claseService.desactivar(id);
        return ResponseEntity.ok(Map.of("mensaje", "Clase desactivada"));
    }
}
