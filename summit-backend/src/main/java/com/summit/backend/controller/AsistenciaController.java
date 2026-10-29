package com.summit.backend.controller;

import com.summit.backend.dto.CheckInResponse;
import com.summit.backend.service.AsistenciaPersonalService;
import com.summit.backend.service.AsistenciaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller del control de acceso en recepción (ingreso por DNI) y del historial de asistencia.
 */
@RestController
@RequestMapping("/api/asistencia")
@RequiredArgsConstructor
public class AsistenciaController {

    private final AsistenciaService asistenciaService;
    private final AsistenciaPersonalService asistenciaPersonalService;

    @PostMapping("/molinete/verificar")
    public ResponseEntity<?> verificarMolinete(@RequestBody Map<String, String> request) {
        CheckInResponse response = asistenciaService.verificarAccesoMolinete(request.get("dni"));
        return ResponseEntity.status(response.isPermitido() ? 200 : 403).body(response);
    }

    /**
     * Dejar pasar por excepción (cuota vencida o sin días del plan; nunca sin apto médico).
     * Body: {"dni": "...", "motivo": "..."}. Quién autoriza sale del token.
     */
    @PostMapping("/molinete/excepcion")
    public ResponseEntity<?> ingresoPorExcepcion(@RequestBody Map<String, String> request, Authentication auth) {
        return ResponseEntity.ok(asistenciaService.registrarIngresoExcepcion(
                request.get("dni"), request.get("motivo"), auth.getName()));
    }

    /**
     * Personal del gimnasio: recepción corrige en el momento un paso que el sistema tomó al revés ("Es una entrada" /
     * "Es una salida"). Body: {"idTurno": 12, "fichada": "SALIDA"} (lo que dice la ficha). Quién corrige sale del token.
     */
    @PostMapping("/molinete/invertir-fichada")
    public ResponseEntity<?> invertirFichada(@RequestBody InvertirFichadaRequest request, Authentication auth) {
        return ResponseEntity.ok(asistenciaPersonalService.invertirFichada(request.idTurno(), request.fichada(), auth.getName()));
    }

    public record InvertirFichadaRequest(Long idTurno, String fichada) {}

    @GetMapping("/historial/{idUsuario}")
    public ResponseEntity<?> historial(@PathVariable Long idUsuario) {
        return ResponseEntity.ok(asistenciaService.historial(idUsuario));
    }
}
