package com.summit.backend.controller;

import com.summit.backend.model.EstadoDebito;
import com.summit.backend.service.DebitoAutomaticoService;
import com.summit.backend.service.MercadoPagoClient.MercadoPagoNoDisponibleException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Supplier;

/**
 * Débito automático mensual desde recepción (ADMIN y RECEPCION: lo exige SecurityConfig).
 * El portal del socio tiene sus propios endpoints en PortalController.
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
        return ejecutar(() -> {
            Long idSocio = Long.valueOf(String.valueOf(request.get("idSocio")));
            Long idPlan = Long.valueOf(String.valueOf(request.get("idPlan")));
            Object email = request.get("emailPagador");
            return debitoService.adherir(idSocio, idPlan, email == null ? null : email.toString(), auth.getName());
        }, HttpStatus.CREATED);
    }

    @PostMapping("/{idDebito}/baja")
    public ResponseEntity<?> darDeBaja(@PathVariable Long idDebito, Authentication auth) {
        return ejecutar(() -> debitoService.darDeBaja(idDebito, auth.getName()), HttpStatus.OK);
    }

    // Consulta a Mercado Pago el estado y los cobros de una adhesión (ej. después de que el socio autorizó)
    @PostMapping("/{idDebito}/sincronizar")
    public ResponseEntity<?> sincronizar(@PathVariable Long idDebito) {
        return ejecutar(() -> debitoService.sincronizar(idDebito), HttpStatus.OK);
    }

    // Botón "Sincronizar ahora": revisa todas las adhesiones vigentes
    @PostMapping("/sincronizar")
    public ResponseEntity<?> sincronizarTodos() {
        return ejecutar(debitoService::sincronizarTodos, HttpStatus.OK);
    }

    // Traduce los errores a códigos HTTP claros para el frontend
    static ResponseEntity<?> ejecutar(Supplier<?> accion, HttpStatus exito) {
        try {
            return ResponseEntity.status(exito).body(accion.get());
        } catch (MercadoPagoNoDisponibleException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", String.valueOf(e.getMessage())));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", String.valueOf(e.getMessage())));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", String.valueOf(e.getMessage())));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Faltan el socio o el plan"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }
}
