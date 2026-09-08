package com.summit.controller;

import com.summit.dto.DashboardMetricasDTO;
import com.summit.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController // Indica que esta clase expone endpoints de una API REST
@RequestMapping("/api/dashboard") // Ruta base para este controlador
@CrossOrigin(origins = "*") // ¡CRÍTICO! Permite que React (en otro puerto) se comunique sin bloqueos de seguridad
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    // Endpoint: GET http://localhost:8080/api/dashboard/metricas
    @GetMapping("/metricas")
    public ResponseEntity<DashboardMetricasDTO> obtenerMetricas() {
        try {
            DashboardMetricasDTO metricas = dashboardService.obtenerMetricasMensuales();
            return ResponseEntity.ok(metricas); // Retorna HTTP 200 OK con el JSON de las métricas
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build(); // Retorna HTTP 500 si algo falla
        }
    }
}