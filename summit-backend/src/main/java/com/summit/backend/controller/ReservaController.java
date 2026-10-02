package com.summit.backend.controller;

import com.summit.backend.model.ReservaClase;
import com.summit.backend.service.ReservaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Controller de reservas de clases grupales.
 */
@RestController
@RequestMapping("/api/reservas")
@RequiredArgsConstructor
public class ReservaController {

    private final ReservaService reservaService;

    @PostMapping
    public ResponseEntity<?> reservar(@RequestBody Map<String, Object> request) {
        try {
            Long idUsuario = Long.valueOf(request.get("idUsuario").toString());
            Long idHorario = Long.valueOf(request.get("idHorario").toString());
            LocalDate fechaClase = LocalDate.parse(request.get("fechaClase").toString());

            ReservaClase reserva = reservaService.reservar(idUsuario, idHorario, fechaClase);
            return ResponseEntity.status(HttpStatus.CREATED).body(reserva);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancelar(@PathVariable Long id) {
        try {
            reservaService.cancelar(id);
            return ResponseEntity.ok(Map.of("mensaje", "Reserva cancelada correctamente"));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/socio/{idUsuario}")
    public ResponseEntity<?> listarPorSocio(@PathVariable Long idUsuario) {
        return ResponseEntity.ok(reservaService.listarPorSocio(idUsuario));
    }
}
