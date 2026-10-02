package com.summit.backend.controller;

import com.summit.backend.dto.StaffRequestDTO;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.service.UsuarioService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller de gestión de usuarios/socios.
 * CRUD paginado con filtros por rol y soft delete.
 */
@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService usuarioService;

    @GetMapping
    public ResponseEntity<Page<Usuario>> listar(Pageable pageable) {
        return ResponseEntity.ok(usuarioService.listarTodos(pageable));
    }

    /**
     * Alta de personal (ADMIN, RECEPCION o PROFESOR). Solo ADMIN (ver SecurityConfig).
     */
    @PostMapping
    public ResponseEntity<?> crearStaff(@Valid @RequestBody StaffRequestDTO request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(usuarioService.crearStaff(request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/rol/{rol}")
    public ResponseEntity<List<Usuario>> listarPorRol(@PathVariable String rol) {
        Rol rolEnum = Rol.valueOf(rol.toUpperCase());
        return ResponseEntity.ok(usuarioService.listarPorRol(rolEnum));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> buscarPorId(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(usuarioService.buscarPorId(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/dni/{dni}")
    public ResponseEntity<?> buscarPorDni(@PathVariable String dni) {
        try {
            return ResponseEntity.ok(usuarioService.buscarPorDni(dni));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Long id, @RequestBody Usuario datos) {
        try {
            return ResponseEntity.ok(usuarioService.actualizar(id, datos));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> desactivar(@PathVariable Long id) {
        try {
            usuarioService.desactivar(id);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario desactivado correctamente"));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/{id}/activar")
    public ResponseEntity<?> activar(@PathVariable Long id) {
        try {
            usuarioService.activar(id);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario reactivado correctamente"));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
