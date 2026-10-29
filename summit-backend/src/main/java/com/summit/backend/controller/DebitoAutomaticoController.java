package com.summit.backend.controller;

import com.summit.backend.model.EstadoDebito;
import com.summit.backend.service.DebitoAutomaticoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Débito automático mensual desde recepción (ADMIN y RECEPCION: lo exige SecurityConfig).
 */
@RestController
@RequestMapping("/api/debitos")
@RequiredArgsConstructor
public class DebitoAutomaticoController {

    private final DebitoAutomaticoService debitoService;

    // Si la credencial de Mercado Pago está cargada (sin ella, las pantallas explican cómo activarlo)
    @GetMapping("/estado")
    public Map<String, Boolean> estado() {
        return Map.of("habilitado", debitoService.habilitado());
    }

    @GetMapping
    public ResponseEntity<?> listar(@RequestParam(required = false) EstadoDebito estado) {
        return ResponseEntity.ok(debitoService.listar(estado));
    }

    @GetMapping("/socio/{idSocio}")
    public ResponseEntity<?> delSocio(@PathVariable Long idSocio) {
        return ResponseEntity.ok(debitoService.delSocio(idSocio));
    }

    /**
     * Body: {"idSocio": 4, "idPlan": 2, "emailPagador": "opcional@mail.com"}.
     * Devuelve la adhesión con el link de autorización (recepción lo muestra como QR).
     */
    @PostMapping
    public ResponseEntity<?> adherir(@RequestBody Map<String, Object> request, Authentication auth) {
        if (request.get("idSocio") == null || request.get("idPlan") == null) {
            throw new IllegalArgumentException("Faltan el socio o el plan");
        }
        Long idSocio = Long.valueOf(String.valueOf(request.get("idSocio")));
        Long idPlan = Long.valueOf(String.valueOf(request.get("idPlan")));
        Object email = request.get("emailPagador");
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(debitoService.adherir(idSocio, idPlan, email == null ? null : email.toString(), auth.getName()));
    }

    @PostMapping("/{idDebito}/baja")
    public ResponseEntity<?> darDeBaja(@PathVariable Long idDebito, Authentication auth) {
        return ResponseEntity.ok(debitoService.darDeBaja(idDebito, auth.getName()));
    }

    // Consulta a Mercado Pago el estado y los cobros de una adhesión (ej. después de que el socio autorizó)
    @PostMapping("/{idDebito}/sincronizar")
    public ResponseEntity<?> sincronizar(@PathVariable Long idDebito) {
        return ResponseEntity.ok(debitoService.sincronizar(idDebito));
    }

    // Botón "Sincronizar ahora": revisa todas las adhesiones vigentes
    @PostMapping("/sincronizar")
    public ResponseEntity<?> sincronizarTodos() {
        return ResponseEntity.ok(debitoService.sincronizarTodos());
    }
}
