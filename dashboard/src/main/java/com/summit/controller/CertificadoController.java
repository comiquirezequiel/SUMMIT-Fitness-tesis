package com.summit.controller;

import com.summit.service.CertificadoService;
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
}