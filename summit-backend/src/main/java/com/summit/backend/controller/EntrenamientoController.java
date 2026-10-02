package com.summit.backend.controller;

import com.summit.backend.dto.LogEntrenamientoRequestDTO;
import com.summit.backend.service.EntrenamientoService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Controller de entrenamientos: lo que el socio anota de su rutina (peso y RPE) y su historial.
 * Consultan ADMIN, RECEPCION y PROFESOR (cualquier socio) y el socio (solo lo suyo);
 * cargan y borran ADMIN, PROFESOR y el socio dueño (SecurityConfig).
 * Los errores (404 / 400 con {"error"}) los arma EntrenamientoExceptionHandler.
 */
@RestController
@RequestMapping("/api/entrenamientos")
@RequiredArgsConstructor
public class EntrenamientoController {

    private final EntrenamientoService entrenamientoService;

    /**
     * Registra un ejercicio de la rutina: 201 si es nuevo, 200 si actualizó el de esa fecha.
     */
    @PostMapping
    public ResponseEntity<?> registrar(@RequestBody LogEntrenamientoRequestDTO request, Authentication auth) {
        if (esOtroSocio(auth, entrenamientoService.socioDelEjercicioDeRutina(request.getIdRutinaEjercicio()))) {
            return soloLoPropio();
        }
        EntrenamientoService.Resultado resultado;
        try {
            resultado = entrenamientoService.registrar(request, auth.getName());
        } catch (DataIntegrityViolationException e) {
            // Dos envíos simultáneos del mismo ejercicio (doble toque en el celular): el segundo actualiza
            resultado = entrenamientoService.registrar(request, auth.getName());
        }
        return ResponseEntity.status(resultado.nuevo() ? HttpStatus.CREATED : HttpStatus.OK).body(resultado.registro());
    }

    @DeleteMapping("/{idLog}")
    public ResponseEntity<?> eliminar(@PathVariable Long idLog, Authentication auth) {
        if (esOtroSocio(auth, entrenamientoService.socioDelRegistro(idLog))) {
            return soloLoPropio();
        }
        entrenamientoService.eliminar(idLog, esSocio(auth));
        return ResponseEntity.ok(Map.of("mensaje", "Registro de entrenamiento eliminado"));
    }

    /**
     * Socios que registraron entrenamientos hoy, con su avance en el día de la rutina.
     * Para el profesor en el salón: solo el personal (un socio ve únicamente lo suyo).
     */
    @GetMapping("/hoy")
    public ResponseEntity<?> entrenandoHoy(Authentication auth) {
        if (esSocio(auth)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Solo el personal del gimnasio puede ver quiénes entrenan hoy"));
        }
        return ResponseEntity.ok(entrenamientoService.entrenandoHoy());
    }

    /**
     * Sesiones del socio (por defecto, los últimos 90 días), de la más reciente a la más vieja.
     */
    @GetMapping("/socio/{idSocio}/sesiones")
    public ResponseEntity<?> sesiones(@PathVariable Long idSocio,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
                                      Authentication auth) {
        if (esOtroSocio(auth, idSocio)) {
            return soloLoPropio();
        }
        return ResponseEntity.ok(entrenamientoService.sesiones(idSocio, desde, hasta));
    }

    /**
     * Ejercicios registrados en una fecha (hoy si no se indica).
     */
    @GetMapping("/socio/{idSocio}")
    public ResponseEntity<?> registrosDelDia(@PathVariable Long idSocio,
                                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha,
                                             Authentication auth) {
        if (esOtroSocio(auth, idSocio)) {
            return soloLoPropio();
        }
        return ResponseEntity.ok(entrenamientoService.registrosDelDia(idSocio, fecha));
    }

    /**
     * Ejercicios con historial, para elegir cuál graficar.
     */
    @GetMapping("/socio/{idSocio}/ejercicios")
    public ResponseEntity<?> ejerciciosConHistorial(@PathVariable Long idSocio, Authentication auth) {
        if (esOtroSocio(auth, idSocio)) {
            return soloLoPropio();
        }
        return ResponseEntity.ok(entrenamientoService.ejerciciosConHistorial(idSocio));
    }

    /**
     * Progreso de un ejercicio (del registro más viejo al más nuevo) para el gráfico.
     */
    @GetMapping("/socio/{idSocio}/progreso")
    public ResponseEntity<?> progreso(@PathVariable Long idSocio,
                                      @RequestParam(required = false) Long idEjercicio,
                                      Authentication auth) {
        if (esOtroSocio(auth, idSocio)) {
            return soloLoPropio();
        }
        return ResponseEntity.ok(entrenamientoService.progreso(idSocio, idEjercicio));
    }

    // Un socio solo ve y carga sus propios entrenamientos; el personal, los de cualquier socio
    private boolean esOtroSocio(Authentication auth, Long idSocio) {
        return esSocio(auth) && !entrenamientoService.esElSocio(auth.getName(), idSocio);
    }

    private static boolean esSocio(Authentication auth) {
        return auth.getAuthorities().stream().anyMatch(a -> "ROLE_SOCIO".equals(a.getAuthority()));
    }

    private static ResponseEntity<Map<String, String>> soloLoPropio() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Solo podés ver y cargar tus propios entrenamientos"));
    }
}
