package com.summit.backend.controller;

import com.summit.backend.model.Plan;
import com.summit.backend.service.PlanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller de planes del gimnasio.
 */
@RestController
@RequestMapping("/api/planes")
@RequiredArgsConstructor
public class PlanController {

    private final PlanService planService;

    @GetMapping
    public ResponseEntity<?> listar() {
        return ResponseEntity.ok(planService.listar());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(planService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Plan plan) {
        return ResponseEntity.status(HttpStatus.CREATED).body(planService.crear(plan));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Long id, @RequestBody Plan plan) {
        return ResponseEntity.ok(planService.actualizar(id, plan));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> desactivar(@PathVariable Long id) {
        planService.desactivar(id);
        return ResponseEntity.ok(Map.of("mensaje", "Plan desactivado"));
    }
}
