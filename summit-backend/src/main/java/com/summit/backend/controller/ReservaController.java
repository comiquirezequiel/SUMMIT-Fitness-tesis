package com.summit.backend.controller;

import com.summit.backend.model.EstadoReserva;
import com.summit.backend.model.ReservaClase;
import com.summit.backend.service.ReservaService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Controller de reservas de clases grupales: el personal anota a los socios, cancela y toma asistencia.
 */
@RestController
@RequestMapping("/api/reservas")
@RequiredArgsConstructor
public class ReservaController {

    private final ReservaService reservaService;

    @PostMapping
    public ResponseEntity<?> reservar(@RequestBody Map<String, Object> request) {
        try {
            if (request.get("idUsuario") == null || request.get("idHorario") == null || request.get("fechaClase") == null) {
                throw new IllegalArgumentException("Faltan datos de la reserva (socio, horario o fecha)");
            }
            Long idUsuario = Long.valueOf(request.get("idUsuario").toString());
            Long idHorario = Long.valueOf(request.get("idHorario").toString());
            LocalDate fechaClase = LocalDate.parse(request.get("fechaClase").toString());

            ReservaClase reserva = reservaService.reservar(idUsuario, idHorario, fechaClase);
            return ResponseEntity.status(HttpStatus.CREATED).body(ReservaService.toDTO(reserva));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancelar(@PathVariable Long id) {
        try {
            reservaService.cancelar(id);
            return ResponseEntity.ok(Map.of("mensaje", "Reserva cancelada correctamente"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Marca la asistencia: body {"estado": "ASISTIO"} o {"estado": "AUSENTE"}.
     */
    @PatchMapping("/{id}/asistencia")
    public ResponseEntity<?> registrarAsistencia(@PathVariable Long id, @RequestBody Map<String, String> request) {
        try {
            EstadoReserva estado = EstadoReserva.valueOf(String.valueOf(request.get("estado")).toUpperCase());
            return ResponseEntity.ok(reservaService.registrarAsistencia(id, estado));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    @GetMapping("/horario/{idHorario}")
    public ResponseEntity<?> listarPorHorario(@PathVariable Long idHorario,
                                              @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
        return ResponseEntity.ok(reservaService.listarPorHorario(idHorario, fecha));
    }

    @GetMapping("/socio/{idUsuario}")
    public ResponseEntity<?> listarPorSocio(@PathVariable Long idUsuario) {
        return ResponseEntity.ok(reservaService.listarPorSocio(idUsuario));
    }
}
