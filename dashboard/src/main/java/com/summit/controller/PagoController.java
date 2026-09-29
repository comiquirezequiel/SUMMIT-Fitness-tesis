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
            // Incluimos el estado real del pago para que el frontend muestre el mensaje correcto
            Map<String, Object> response = new HashMap<>();
            response.put("id_pago_local", pagoProcesado.getId());
            response.put("estado", pagoProcesado.getEstadoPago().toString());
            
            // Mensaje dinámico según el estado real del pago
            String mensaje;
            // Si el pago fue APROBADO, mostramos mensaje de éxito con el ID de transacción
            if (pagoProcesado.getEstadoPago() == com.summit.model.enums.EstadoPago.APROBADO) {
                mensaje = "¡Pago Aprobado! ID de transacción: " + pagoProcesado.getId();
            // Si el pago quedó PENDIENTE, informamos que está en proceso de confirmación
            } else if (pagoProcesado.getEstadoPago() == com.summit.model.enums.EstadoPago.PENDIENTE) {
                mensaje = "Pago pendiente de confirmación. ID de transacción: " + pagoProcesado.getId();
            // Si el pago fue RECHAZADO, mostramos mensaje de error
            } else {
                mensaje = "Pago rechazado. Verificá los datos de la tarjeta e intentá nuevamente.";
            }
            response.put("mensaje", mensaje);
            
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