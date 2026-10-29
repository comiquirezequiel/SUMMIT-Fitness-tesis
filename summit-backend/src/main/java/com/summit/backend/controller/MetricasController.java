package com.summit.backend.controller;

import com.summit.backend.service.MetricasService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * Métricas con datos reales. ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD (por defecto, los últimos 30 días).
 * Asistencia: ADMIN y RECEPCION. Ingresos: solo ADMIN (lo exige SecurityConfig).
 */
@RestController
@RequestMapping("/api/metricas")
@RequiredArgsConstructor
public class MetricasController {

    private final MetricasService metricasService;

    @GetMapping("/socios")
    public MetricasService.AnaliticaSocios socios(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
        return metricasService.socios(desde, hasta);
    }

    @GetMapping("/ingresos")
    public MetricasService.AnaliticaIngresos ingresos(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
        return metricasService.ingresos(desde, hasta);
    }
}
