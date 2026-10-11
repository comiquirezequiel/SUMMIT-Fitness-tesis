package com.summit.backend.controller;

import com.summit.backend.dto.CheckInRequest;
import com.summit.backend.dto.CheckInResponse;
import com.summit.backend.service.AsistenciaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.Map;

/**
 * Controller de asistencia y check-in.
 * Endpoint protegido contra spam por RateLimitingFilter + cooldown interno.
 */
@RestController
@RequestMapping("/api/asistencia")
@RequiredArgsConstructor
public class AsistenciaController {

    private final AsistenciaService asistenciaService;

    @PostMapping("/checkin")
    public ResponseEntity<?> checkIn(@Valid @RequestBody CheckInRequest request) {
        try {
            CheckInResponse response = asistenciaService.procesarCheckIn(request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    @PostMapping("/molinete/verificar")
    public ResponseEntity<?> verificarMolinete(@RequestBody Map<String, String> request) {
        try {
            String dni = request.get("dni");
            CheckInResponse response = asistenciaService.verificarAccesoMolinete(dni);
            if (response.isPermitido()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(403).body(response);
            }
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Dejar pasar por excepción (cuota vencida o sin días del plan; nunca sin apto médico).
     * Body: {"dni": "...", "motivo": "..."}. Quién autoriza sale del token.
     */
    @PostMapping("/molinete/excepcion")
    public ResponseEntity<?> ingresoPorExcepcion(@RequestBody Map<String, String> request, Authentication auth) {
        try {
            return ResponseEntity.ok(asistenciaService.registrarIngresoExcepcion(
                    request.get("dni"), request.get("motivo"), auth.getName()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/historial/{idUsuario}")
    public ResponseEntity<?> historial(@PathVariable Long idUsuario) {
        try {
            return ResponseEntity.ok(asistenciaService.historial(idUsuario));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
