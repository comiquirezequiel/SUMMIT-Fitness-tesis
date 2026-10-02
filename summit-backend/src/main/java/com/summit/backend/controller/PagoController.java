package com.summit.backend.controller;

import com.summit.backend.dto.CajaResumenDTO;
import com.summit.backend.dto.PagoListadoDTO;
import com.summit.backend.model.MetodoPago;
import com.summit.backend.model.PagoHistorial;
import com.summit.backend.service.PagoService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
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
            Long idUsuario = Long.valueOf(obligatorio(request, "idUsuario"));
            Long idPlan = Long.valueOf(obligatorio(request, "idPlan"));
            BigDecimal monto = new BigDecimal(obligatorio(request, "monto"));
            MetodoPago metodoPago = MetodoPago.valueOf(obligatorio(request, "metodoPago").toUpperCase());
            Object comprobante = request.get("comprobante");

            PagoHistorial pago = pagoService.registrarPago(idUsuario, idPlan, monto, metodoPago,
                    comprobante == null ? "" : comprobante.toString());
            return ResponseEntity.status(HttpStatus.CREATED).body(pago);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Datos numéricos inválidos en el cobro"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    /**
     * Movimientos de caja paginados, del más reciente al más antiguo.
     */
    @GetMapping
    public ResponseEntity<Page<PagoListadoDTO>> listar(
            @PageableDefault(size = 20, sort = "fechaPago", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(pagoService.listar(pageable));
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
