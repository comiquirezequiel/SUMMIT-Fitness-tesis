package com.summit.backend.controller;

import com.summit.backend.model.ConfiguracionAcceso;
import com.summit.backend.service.ConfiguracionAccesoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Reglas de acceso del gimnasio. Ver ADMIN y RECEPCION; cambiar, solo ADMIN (SecurityConfig).
 */
@RestController
@RequestMapping("/api/configuracion/acceso")
@RequiredArgsConstructor
public class ConfiguracionAccesoController {

    private final ConfiguracionAccesoService configuracionAccesoService;

    @GetMapping
    public ResponseEntity<ConfiguracionAcceso> obtenerConfiguracion() {
        return ResponseEntity.ok(configuracionAccesoService.obtenerConfiguracionGlobal());
    }

    @PutMapping
    public ResponseEntity<?> actualizarConfiguracion(@RequestBody ConfiguracionAcceso config) {
        try {
            return ResponseEntity.ok(configuracionAccesoService.actualizarConfiguracion(config));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Genera un código nuevo para el QR de ingreso (los QR impresos anteriores dejan de servir). */
    @PostMapping("/codigo-qr")
    public ResponseEntity<ConfiguracionAcceso> regenerarCodigoQr() {
        return ResponseEntity.ok(configuracionAccesoService.regenerarCodigoQr());
    }
}
