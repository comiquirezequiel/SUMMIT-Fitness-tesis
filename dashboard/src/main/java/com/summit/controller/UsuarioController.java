package com.summit.controller;

import com.summit.dto.NuevoSocioDTO;
import com.summit.model.entity.Usuario;
import com.summit.service.UsuarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@CrossOrigin(origins = "*")
public class UsuarioController {

    @Autowired
    private UsuarioService usuarioService;

    @PostMapping("/nuevo")
    public ResponseEntity<?> crearSocio(@RequestBody NuevoSocioDTO request) {
        try {
            usuarioService.registrarNuevoSocio(request);
            Map<String, String> response = new HashMap<>();
            response.put("mensaje", "Socio creado exitosamente en estado PENDIENTE.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping
    public ResponseEntity<List<Usuario>> listarSocios() {
        return ResponseEntity.ok(usuarioService.obtenerTodosLosSocios());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminarSocio(@PathVariable Long id) {
        try {
            usuarioService.eliminarSocio(id);
            Map<String, String> response = new HashMap<>();
            response.put("mensaje", "Socio eliminado correctamente del sistema.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

}