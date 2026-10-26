package com.summit.backend.controller;

import com.summit.backend.dto.ContactoRequestDTO;
import com.summit.backend.dto.InactividadDTO;
import com.summit.backend.dto.TareaDTO;
import com.summit.backend.dto.TareaRequestDTO;
import com.summit.backend.service.SeguimientoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Seguimiento de socios: inactividad y tareas de contacto. ADMIN y RECEPCION (SecurityConfig).
 */
@RestController
@RequestMapping("/api/seguimiento")
@RequiredArgsConstructor
public class SeguimientoController {

    private final SeguimientoService seguimientoService;

    /** Socios que hace minDias o más que no vienen (como mínimo 7). */
    @GetMapping("/inactividad")
    public ResponseEntity<InactividadDTO> inactividad(@RequestParam(defaultValue = "7") int minDias) {
        return ResponseEntity.ok(seguimientoService.inactividad(minDias));
    }

    /** ?vista=resueltas: las últimas 50 resueltas; si no, las pendientes. */
    @GetMapping("/tareas")
    public ResponseEntity<List<TareaDTO>> tareas(@RequestParam(defaultValue = "pendientes") String vista) {
        return ResponseEntity.ok("resueltas".equals(vista) ? seguimientoService.resueltas(50) : seguimientoService.pendientes());
    }

    @GetMapping("/tareas/cantidad")
    public ResponseEntity<Map<String, Long>> cantidad() {
        return ResponseEntity.ok(seguimientoService.cantidades());
    }

    /** Genera ahora las tareas automáticas (además corre sola cada hora). */
    @PostMapping("/tareas/generar")
    public ResponseEntity<Map<String, Integer>> generar() {
        return ResponseEntity.ok(seguimientoService.generarTareas());
    }

    @PostMapping("/tareas")
    public ResponseEntity<TareaDTO> crear(@Valid @RequestBody TareaRequestDTO pedido, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(seguimientoService.crear(pedido, auth.getName()));
    }

    /** Body: {"estado": "HECHA" | "DESCARTADA", "canal": "WHATSAPP", "nota": "..."} */
    @PostMapping("/tareas/{idTarea}/resolver")
    public ResponseEntity<TareaDTO> resolver(@PathVariable Long idTarea, @Valid @RequestBody ContactoRequestDTO pedido,
                                             Authentication auth) {
        return ResponseEntity.ok(seguimientoService.resolver(idTarea, pedido, auth.getName()));
    }

    /** Se contactó a un socio inactivo. Body: {"idSocio": 12, "canal": "WHATSAPP", "nota": "..."} */
    @PostMapping("/contactos")
    public ResponseEntity<TareaDTO> contacto(@Valid @RequestBody ContactoRequestDTO pedido, Authentication auth) {
        return ResponseEntity.ok(seguimientoService.registrarContacto(pedido, auth.getName()));
    }
}
