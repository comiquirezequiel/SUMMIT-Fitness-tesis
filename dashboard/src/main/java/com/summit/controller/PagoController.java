package com.summit.controller;

import com.mercadopago.exceptions.MPApiException;
import com.summit.dto.PagoRequestDTO;
import com.summit.model.entity.Pago;
import com.summit.service.PagoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/pagos")
@CrossOrigin(origins = "*")
public class PagoController {

    @Autowired
    private PagoService pagoService;

    @PostMapping("/procesar")
    public ResponseEntity<?> procesarPagoWeb(@RequestBody PagoRequestDTO request) {
        try {
            Pago pagoProcesado = pagoService.procesarPagoTarjeta(request);
            
            // Armamos una respuesta limpia para el Frontend
            Map<String, Object> response = new HashMap<>();
            response.put("id_pago_local", pagoProcesado.getId());
            response.put("estado", pagoProcesado.getEstadoPago().toString());
            response.put("mensaje", "Transacción procesada correctamente");
            
            return ResponseEntity.ok(response);
            
        } catch (MPApiException apiException) {
            // ¡ESTO IMPRIMIRÁ EL ERROR EXACTO EN TU TERMINAL!
            System.out.println("❌ ERROR DE MERCADO PAGO: " + apiException.getApiResponse().getContent());
            
            Map<String, String> error = new HashMap<>();
            error.put("error", "Rechazado por Mercado Pago. Revisá la consola del servidor.");
            return ResponseEntity.badRequest().body(error);
            
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}