package com.summit.backend.controller;

import com.summit.backend.model.Suscripcion;
import com.summit.backend.service.SuscripcionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller de suscripciones.
 */
@RestController
@RequestMapping("/api/suscripciones")
@RequiredArgsConstructor
public class SuscripcionController {

    private final SuscripcionService suscripcionService;

    @GetMapping("/socio/{idUsuario}")
    public ResponseEntity<?> listarPorSocio(@PathVariable Long idUsuario) {
        return ResponseEntity.ok(suscripcionService.listarPorSocio(idUsuario));
    }

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Map<String, Long> request) {
        try {
            Long idUsuario = request.get("idUsuario");
            Long idPlan = request.get("idPlan");
            Suscripcion suscripcion = suscripcionService.crearSuscripcion(idUsuario, idPlan);
            return ResponseEntity.status(HttpStatus.CREATED).body(suscripcion);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/verificar/{idUsuario}")
    public ResponseEntity<?> verificarCuota(@PathVariable Long idUsuario) {
        boolean alDia = suscripcionService.verificarCuotaAlDia(idUsuario);
        return ResponseEntity.ok(Map.of("cuotaAlDia", alDia));
    }
}
