package com.summit.backend.controller;

import com.summit.backend.dto.RutinaDTO;
import com.summit.backend.dto.RutinaEjercicioRequestDTO;
import com.summit.backend.dto.RutinaRequestDTO;
import com.summit.backend.service.RutinaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller de rutinas de entrenamiento.
 * Las arman ADMIN y PROFESOR (SecurityConfig); un socio solo consulta las suyas.
 * Los errores (404 / 400 con {"error"}) los arma EntrenamientoExceptionHandler.
 */
@RestController
@RequestMapping("/api/rutinas")
@RequiredArgsConstructor
public class RutinaController {

    private final RutinaService rutinaService;

    /**
     * Rutinas activas del socio, la más reciente primero.
     */
    @GetMapping("/socio/{idSocio}")
    public ResponseEntity<?> listarPorSocio(@PathVariable Long idSocio, Authentication auth) {
        if (esOtroSocio(auth, idSocio)) {
            return soloLaPropia();
        }
        return ResponseEntity.ok(rutinaService.listarActivasPorSocio(idSocio));
    }

    /**
     * Rutina del día: qué día le toca, lo que ya cargó hoy y lo de la vez pasada.
     * Con ?dia=N muestra otro día de la rutina.
     */
    @GetMapping("/socio/{idSocio}/hoy")
    public ResponseEntity<?> rutinaDeHoy(@PathVariable Long idSocio,
                                         @RequestParam(required = false) Integer dia,
                                         Authentication auth) {
        if (esOtroSocio(auth, idSocio)) {
            return soloLaPropia();
        }
        return ResponseEntity.ok(rutinaService.rutinaDeHoy(idSocio, dia));
    }

    /**
     * Cruce preventivo: patologías del socio que contraindican el ejercicio.
     * Es dato de salud: solo ADMIN y PROFESOR (SecurityConfig).
     */
    @GetMapping("/validar-ejercicio")
    public ResponseEntity<?> validarEjercicio(@RequestParam(required = false) Long idSocio,
                                              @RequestParam(required = false) Long idEjercicio) {
        if (idSocio == null || idEjercicio == null) {
            throw new IllegalArgumentException("Indicá el socio y el ejercicio");
        }
        List<String> riesgos = rutinaService.validarEjercicioContraindicado(idSocio, idEjercicio);
        return ResponseEntity.ok(Map.of("contraindicado", !riesgos.isEmpty(), "riesgos", riesgos));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> buscarPorId(@PathVariable Long id, Authentication auth) {
        RutinaDTO rutina = rutinaService.buscarPorId(id);
        if (esOtroSocio(auth, rutina.getIdSocio())) {
            return soloLaPropia();
        }
        return ResponseEntity.ok(rutina);
    }

    /**
     * Crea la rutina del socio (las anteriores activas pasan a inactivas).
     * Body: {idSocio, nombre, objetivo} o el formato anterior {nombre, objetivo, socio: {idUsuario}}.
     */
    @PostMapping
    public ResponseEntity<?> crear(@RequestBody RutinaRequestDTO request, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(rutinaService.crear(request, auth.getName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Long id, @RequestBody RutinaRequestDTO request) {
        return ResponseEntity.ok(rutinaService.actualizar(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> desactivar(@PathVariable Long id) {
        rutinaService.desactivar(id);
        return ResponseEntity.ok(Map.of("mensaje", "Rutina desactivada"));
    }

    /**
     * Agrega un ejercicio. Si está contraindicado para el socio responde 400 con los riesgos,
     * salvo que el profesor lo fuerce (?forzar=true) asumiendo el riesgo.
     */
    @PostMapping("/{id}/ejercicios")
    public ResponseEntity<?> agregarEjercicio(@PathVariable Long id,
                                              @RequestBody RutinaEjercicioRequestDTO request,
                                              @RequestParam(required = false, defaultValue = "false") boolean forzar) {
        return ResponseEntity.status(HttpStatus.CREATED).body(rutinaService.agregarEjercicio(id, request, forzar));
    }

    @PutMapping("/{id}/ejercicios/{idRutinaEjercicio}")
    public ResponseEntity<?> actualizarEjercicio(@PathVariable Long id,
                                                 @PathVariable Long idRutinaEjercicio,
                                                 @RequestBody RutinaEjercicioRequestDTO request) {
        return ResponseEntity.ok(rutinaService.actualizarEjercicio(id, idRutinaEjercicio, request));
    }

    @DeleteMapping("/{id}/ejercicios/{idRutinaEjercicio}")
    public ResponseEntity<?> quitarEjercicio(@PathVariable Long id, @PathVariable Long idRutinaEjercicio) {
        rutinaService.quitarEjercicio(id, idRutinaEjercicio);
        return ResponseEntity.ok(Map.of("mensaje", "Ejercicio quitado de la rutina"));
    }

    // Un socio solo ve sus propias rutinas; el personal, las de cualquier socio
    private boolean esOtroSocio(Authentication auth, Long idSocio) {
        boolean esSocio = auth.getAuthorities().stream().anyMatch(a -> "ROLE_SOCIO".equals(a.getAuthority()));
        return esSocio && !rutinaService.esElSocio(auth.getName(), idSocio);
    }

    private static ResponseEntity<Map<String, String>> soloLaPropia() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Solo podés ver tu propia rutina"));
    }
}
