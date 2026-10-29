package com.summit.backend.controller;

import com.summit.backend.dto.DashboardResumenDTO;
import com.summit.backend.dto.IngresoDTO;
import com.summit.backend.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Tablero de recepción: indicadores y actividad de ingresos del día.
 * Solo ADMIN y RECEPCION (ver SecurityConfig).
 */
@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/resumen")
    public ResponseEntity<DashboardResumenDTO> resumen() {
        return ResponseEntity.ok(dashboardService.resumen());
    }

    @GetMapping("/ingresos-hoy")
    public ResponseEntity<List<IngresoDTO>> ingresosDeHoy() {
        return ResponseEntity.ok(dashboardService.ingresosDeHoy());
    }
}
