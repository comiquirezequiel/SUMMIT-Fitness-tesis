package com.summit.backend.controller;

import com.summit.backend.dto.CajaResumenDTO;
import com.summit.backend.dto.PagoListadoDTO;
import com.summit.backend.model.EstadoPago;
import com.summit.backend.model.MetodoPago;
import com.summit.backend.service.PagoService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Controller de pagos y caja (cobros presenciales en recepción).
 */
@RestController
@RequestMapping("/api/pagos")
@RequiredArgsConstructor
public class PagoController {

    private final PagoService pagoService;

    /**
     * Registra un cobro. "aVerificar": true deja una transferencia o un QR pendiente hasta que el admin lo confirme.
     * Quién cobró sale del token, nunca del body.
     */
    @PostMapping
    public ResponseEntity<?> registrar(@RequestBody Map<String, Object> request, Authentication auth) {
        try {
            Long idUsuario = Long.valueOf(obligatorio(request, "idUsuario"));
            Long idPlan = Long.valueOf(obligatorio(request, "idPlan"));
            BigDecimal monto = new BigDecimal(obligatorio(request, "monto"));
            MetodoPago metodoPago = MetodoPago.valueOf(obligatorio(request, "metodoPago").toUpperCase());
            Object comprobante = request.get("comprobante");
            boolean aVerificar = Boolean.parseBoolean(String.valueOf(request.get("aVerificar")));

            PagoListadoDTO pago = pagoService.registrarPago(idUsuario, idPlan, monto, metodoPago,
                    comprobante == null ? "" : comprobante.toString(), aVerificar, auth.getName());
            return ResponseEntity.status(HttpStatus.CREATED).body(pago);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Datos numéricos inválidos en el cobro"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    /**
     * Confirma o rechaza un pago "a verificar" (solo ADMIN: lo exige SecurityConfig).
     * Body: {"aprobado": true|false}
     */
    @PostMapping("/{idPago}/verificar")
    public ResponseEntity<?> verificar(@PathVariable Long idPago, @RequestBody Map<String, Object> request,
                                       Authentication auth) {
        Object aprobado = request.get("aprobado");
        if (!(aprobado instanceof Boolean decision)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Indicá si el pago se aprueba o se rechaza"));
        }
        try {
            return ResponseEntity.ok(pagoService.verificarPago(idPago, decision, auth.getName()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", String.valueOf(e.getMessage())));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    /**
     * Movimientos de caja paginados, del más reciente al más antiguo. ?estado=PENDIENTE filtra los "a verificar".
     */
    @GetMapping
    public ResponseEntity<Page<PagoListadoDTO>> listar(
            @RequestParam(required = false) EstadoPago estado,
            @PageableDefault(size = 20, sort = "fechaPago", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(pagoService.listar(estado, pageable));
    }

    @GetMapping("/resumen")
    public ResponseEntity<CajaResumenDTO> resumen() {
        return ResponseEntity.ok(pagoService.resumen());
    }

    @GetMapping("/socio/{idUsuario}")
    public ResponseEntity<?> historial(@PathVariable Long idUsuario) {
        return ResponseEntity.ok(pagoService.historialPorSocio(idUsuario));
    }

    private static String obligatorio(Map<String, Object> request, String campo) {
        Object valor = request.get(campo);
        if (valor == null || valor.toString().isBlank()) {
            throw new IllegalArgumentException("Falta el campo " + campo);
        }
        return valor.toString();
    }
}
