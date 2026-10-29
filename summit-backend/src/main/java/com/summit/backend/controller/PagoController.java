package com.summit.backend.controller;

import com.summit.backend.dto.CajaResumenDTO;
import com.summit.backend.dto.CobroConTarjetaDTO;
import com.summit.backend.dto.CobroRequestDTO;
import com.summit.backend.dto.PagoListadoDTO;
import com.summit.backend.mercadopago.PasarelaTarjeta;
import com.summit.backend.model.EstadoPago;
import com.summit.backend.service.CobroConTarjetaService;
import com.summit.backend.service.MercadoPagoClient.MercadoPagoNoDisponibleException;
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

import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Controller de pagos y caja (cobros de recepción: en persona y con tarjeta por Mercado Pago).
 */
@RestController
@RequestMapping("/api/pagos")
@RequiredArgsConstructor
public class PagoController {

    private final PagoService pagoService;
    private final CobroConTarjetaService cobroConTarjetaService;
    private final PasarelaTarjeta pasarelaTarjeta;

    /**
     * Registra un cobro (ver CobroRequestDTO). El total lo calcula el backend; si no coincide con el que vio
     * recepción (totalMostrado), responde 409 sin registrar nada. "aVerificar": true deja una transferencia o un QR
     * pendiente hasta que el admin lo confirme. Quién cobró sale del token, nunca del body.
     */
    @PostMapping
    public ResponseEntity<?> registrar(@RequestBody CobroRequestDTO pedido, Authentication auth) {
        try {
            PagoListadoDTO pago = pagoService.registrarPago(pedido, auth.getName());
            return ResponseEntity.status(HttpStatus.CREATED).body(pago);
        } catch (PagoService.TotalCambiadoException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", String.valueOf(e.getMessage())));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    /**
     * Cobro con tarjeta (ver CobroConTarjetaDTO): 201 con el pago (aprobado, o a verificar si Mercado Pago lo dejó en
     * proceso), 409 si cambió el total (no se llega a cobrar), 402 si Mercado Pago rechazó la tarjeta (no se registra
     * nada) y 503 si no se pudo hablar con Mercado Pago.
     */
    @PostMapping("/tarjeta")
    public ResponseEntity<?> cobrarConTarjeta(@RequestBody CobroConTarjetaDTO pedido, Authentication auth) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(cobroConTarjetaService.cobrar(pedido, auth.getName()));
        } catch (PagoService.TotalCambiadoException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", String.valueOf(e.getMessage())));
        } catch (CobroConTarjetaService.TarjetaRechazadaException e) {
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
                    .body(Map.of("error", String.valueOf(e.getMessage()), "codigo", "TARJETA_RECHAZADA"));
        } catch (MercadoPagoNoDisponibleException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", String.valueOf(e.getMessage())));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    /** Para el formulario de tarjeta: el modo (SIMULADOR o MERCADO_PAGO) y la clave pública de Mercado Pago. */
    @GetMapping("/tarjeta/config")
    public Map<String, String> configTarjeta() {
        return Map.of("modo", pasarelaTarjeta.modo().name(), "publicKey", pasarelaTarjeta.publicKey());
    }

    /**
     * Detalle de un cobro antes de confirmarlo: precio del plan, descuento, matrícula y total. Mismo body que el
     * cobro; sin idUsuario es el de un socio nuevo.
     */
    @PostMapping("/presupuesto")
    public ResponseEntity<?> presupuesto(@RequestBody CobroRequestDTO pedido) {
        try {
            return ResponseEntity.ok(pagoService.presupuesto(pedido));
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
}
