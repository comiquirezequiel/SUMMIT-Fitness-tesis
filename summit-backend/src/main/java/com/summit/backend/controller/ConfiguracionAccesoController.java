package com.summit.backend.controller;

import com.summit.backend.model.ConfiguracionAcceso;
import com.summit.backend.service.ConfiguracionAccesoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<ConfiguracionAcceso> actualizarConfiguracion(@RequestBody ConfiguracionAcceso config) {
        return ResponseEntity.ok(configuracionAccesoService.actualizarConfiguracion(config));
    }
}
