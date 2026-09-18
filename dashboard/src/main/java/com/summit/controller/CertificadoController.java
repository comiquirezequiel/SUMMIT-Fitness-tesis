package com.summit.controller;

import com.summit.service.CertificadoService;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/certificados")
@CrossOrigin(origins = "*")
public class CertificadoController {

    @Autowired
    private CertificadoService certificadoService;

    // Endpoint: POST http://localhost:8080/api/certificados/simular/{dni}
    @PostMapping("/simular/{dni}")
    public ResponseEntity<String> cargarCertificadoAprobado(@PathVariable String dni) {
        try {
            String mensaje = certificadoService.simularCargaYAuditoria(dni);
            return ResponseEntity.ok(mensaje);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/revision/{id}")
    public ResponseEntity<?> auditarCertificado(@PathVariable Long id, @RequestParam boolean aprobado) {
        try {
            certificadoService.revisarCertificado(id, aprobado);
            Map<String, String> response = new HashMap<>();
            response.put("mensaje", aprobado ? "Certificado Aprobado y socio activado." : "Certificado Rechazado.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

}