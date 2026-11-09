package com.summit.backend.controller;

import com.summit.backend.dto.TurnoRequest;
import com.summit.backend.service.AsistenciaPersonalService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Asistencia del personal (fase 9 del desarrollo): horas trabajadas del equipo y correcciones. Solo ADMIN (ver
 * SecurityConfig). Las entradas y salidas las registra el control de acceso de recepción (/api/asistencia/molinete).
 */
@RestController
@RequestMapping("/api/asistencia/personal")
@RequiredArgsConstructor
public class AsistenciaPersonalController {

    private final AsistenciaPersonalService asistenciaPersonalService;

    /** Horas por persona y por día: ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD (incluidas) y, opcional, &idUsuario=N. */
    @GetMapping
    public ResponseEntity<?> reporte(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
                                     @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
                                     @RequestParam(required = false) Long idUsuario) {
        return ResponseEntity.ok(asistenciaPersonalService.reporte(desde, hasta, idUsuario));
    }

    /** Carga un turno olvidado: body {idUsuario, entrada, salida, motivo}. Quién lo carga sale del token. */
    @PostMapping("/turnos")
    public ResponseEntity<?> agregar(@RequestBody TurnoRequest datos, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(asistenciaPersonalService.agregarTurno(datos, auth.getName()));
    }

    /** Corrige las horas de un turno: body {entrada, salida, motivo} (salida vacía = sigue trabajando). */
    @PutMapping("/turnos/{id}")
    public ResponseEntity<?> corregir(@PathVariable Long id, @RequestBody TurnoRequest datos, Authentication auth) {
        return ResponseEntity.ok(asistenciaPersonalService.corregirTurno(id, datos, auth.getName()));
    }

    /** Anula un turno: body {motivo}. Deja de sumar horas, pero queda guardado con el motivo. */
    @PostMapping("/turnos/{id}/anular")
    public ResponseEntity<?> anular(@PathVariable Long id, @RequestBody(required = false) Map<String, String> datos,
                                    Authentication auth) {
        return ResponseEntity.ok(asistenciaPersonalService.anularTurno(id, datos == null ? null : datos.get("motivo"), auth.getName()));
    }
}
