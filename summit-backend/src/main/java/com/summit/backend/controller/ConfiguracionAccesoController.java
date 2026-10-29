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
}
