package com.summit.backend.controller;

import com.summit.backend.model.EstadoReserva;
import com.summit.backend.model.ReservaClase;
import com.summit.backend.service.ListaEsperaService;
import com.summit.backend.service.ReservaService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
    private final ListaEsperaService listaEsperaService;

    @PostMapping
    public ResponseEntity<?> reservar(@RequestBody Map<String, Object> request, Authentication auth) {
        try {
            if (request.get("idUsuario") == null || request.get("idHorario") == null || request.get("fechaClase") == null) {
                throw new IllegalArgumentException("Faltan datos de la reserva (socio, horario o fecha)");
            }
            Long idUsuario = Long.valueOf(request.get("idUsuario").toString());
            Long idHorario = Long.valueOf(request.get("idHorario").toString());
            LocalDate fechaClase = LocalDate.parse(request.get("fechaClase").toString());
            if (esOtroSocio(auth, idUsuario)) {
                return soloPropias();
            }

            ReservaClase reserva = reservaService.reservar(idUsuario, idHorario, fechaClase);
            // Si esperaba un lugar en esa clase, ya lo tiene
            listaEsperaService.quitarSiReservo(idUsuario, idHorario, fechaClase);
            return ResponseEntity.status(HttpStatus.CREATED).body(ReservaService.toDTO(reserva));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancelar(@PathVariable Long id, Authentication auth) {
        try {
            if (esOtroSocio(auth, reservaService.buscar(id).getSocio().getIdUsuario())) {
                return soloPropias();
            }
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

    /** Lista de espera de una clase en una fecha, en orden (personal del gimnasio, ver SecurityConfig). */
    @GetMapping("/horario/{idHorario}/espera")
    public ResponseEntity<?> listaDeEspera(@PathVariable Long idHorario,
                                           @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
        return ResponseEntity.ok(listaEsperaService.deLaClase(idHorario, fecha));
    }

    @GetMapping("/socio/{idUsuario}")
    public ResponseEntity<?> listarPorSocio(@PathVariable Long idUsuario, Authentication auth) {
        if (esOtroSocio(auth, idUsuario)) {
            return soloPropias();
        }
        return ResponseEntity.ok(reservaService.listarPorSocio(idUsuario));
    }

    // Un socio solo puede reservar, cancelar y ver sus propias reservas; el personal, las de cualquier socio
    private boolean esOtroSocio(Authentication auth, Long idSocio) {
        boolean esSocio = auth.getAuthorities().stream().anyMatch(a -> "ROLE_SOCIO".equals(a.getAuthority()));
        return esSocio && !reservaService.esElSocio(auth.getName(), idSocio);
    }

    private static ResponseEntity<Map<String, String>> soloPropias() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Solo podés gestionar tus propias reservas"));
    }
}
