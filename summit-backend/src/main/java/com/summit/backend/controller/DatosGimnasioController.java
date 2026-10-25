package com.summit.backend.controller;

import com.summit.backend.dto.DatosGimnasioDTO;
import com.summit.backend.service.DatosGimnasioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Datos del gimnasio (Ajustes > Datos del gimnasio). Permisos de SecurityConfig para /api/configuracion/**:
 * los ven ADMIN y RECEPCION; los cambia solo ADMIN. La app del socio los pide a /api/portal/gimnasio.
 */
@RestController
@RequestMapping("/api/configuracion/gimnasio")
@RequiredArgsConstructor
public class DatosGimnasioController {

    private final DatosGimnasioService datosGimnasioService;

    @GetMapping
    public ResponseEntity<DatosGimnasioDTO> obtener() {
        return ResponseEntity.ok(datosGimnasioService.obtenerDTO());
    }

    @PutMapping
    public ResponseEntity<?> actualizar(@RequestBody(required = false) DatosGimnasioDTO pedido) {
        try {
            return ResponseEntity.ok(datosGimnasioService.actualizar(pedido));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }
}
