package com.summit.backend.controller;

import com.summit.backend.dto.EjercicioDTO;
import com.summit.backend.model.GrupoMuscular;
import com.summit.backend.service.EjercicioService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller de ejercicios.
 * Filtrado por grupo muscular para el modelo 2D interactivo.
 * Consulta cualquier usuario autenticado; alta y edición, ADMIN y PROFESOR (SecurityConfig).
 * Los errores (404 / 400 con {"error"}) los arma GlobalExceptionHandler.
 */
@RestController
@RequestMapping("/api/ejercicios")
@RequiredArgsConstructor
public class EjercicioController {

    private final EjercicioService ejercicioService;

    @GetMapping
    public ResponseEntity<?> listar(Pageable pageable) {
        return ResponseEntity.ok(ejercicioService.listar(pageable));
    }

    @GetMapping("/grupo/{grupo}")
    public ResponseEntity<?> buscarPorGrupo(@PathVariable String grupo) {
        GrupoMuscular grupoEnum = GrupoMuscular.valueOf(grupo.toUpperCase());
        return ResponseEntity.ok(ejercicioService.buscarPorGrupoMuscular(grupoEnum));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(ejercicioService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody EjercicioDTO ejercicio) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ejercicioService.crear(ejercicio));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Long id, @RequestBody EjercicioDTO data) {
        return ResponseEntity.ok(ejercicioService.actualizar(id, data));
    }
}
