package com.summit.backend.controller;

import com.summit.backend.model.MetodoPago;
import com.summit.backend.model.PagoHistorial;
import com.summit.backend.service.PagoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Controller de pagos y caja.
 */
@RestController
@RequestMapping("/api/pagos")
@RequiredArgsConstructor
public class PagoController {

    private final PagoService pagoService;

    @PostMapping
    public ResponseEntity<?> registrar(@RequestBody Map<String, Object> request) {
        try {
            Long idUsuario = Long.valueOf(request.get("idUsuario").toString());
            Long idPlan = Long.valueOf(request.get("idPlan").toString());
            BigDecimal monto = new BigDecimal(request.get("monto").toString());
            MetodoPago metodoPago = MetodoPago.valueOf(request.get("metodoPago").toString().toUpperCase());
            String comprobante = request.getOrDefault("comprobante", "").toString();

            PagoHistorial pago = pagoService.registrarPago(idUsuario, idPlan, monto, metodoPago, comprobante);
            return ResponseEntity.status(HttpStatus.CREATED).body(pago);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/socio/{idUsuario}")
    public ResponseEntity<?> historial(@PathVariable Long idUsuario) {
        return ResponseEntity.ok(pagoService.historialPorSocio(idUsuario));
    }
}
