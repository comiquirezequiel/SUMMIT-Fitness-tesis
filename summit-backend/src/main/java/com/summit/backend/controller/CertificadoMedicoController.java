package com.summit.backend.controller;

import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.service.CertificadoMedicoService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/socios/{idSocio}/certificados")
@RequiredArgsConstructor
public class CertificadoMedicoController {

    private final CertificadoMedicoService certificadoMedicoService;

    @Data
    public static class CertificadoRequestDTO {
        @NotBlank(message = "La URL del archivo es obligatoria")
        private String archivoUrl;

        @NotNull(message = "La fecha de emisión es obligatoria")
        private LocalDate fechaEmision;
        
        private String observacionesPatologias;
    }

    @PostMapping
    public ResponseEntity<?> registrarCertificado(
            @PathVariable Long idSocio,
            @Valid @RequestBody CertificadoRequestDTO request) {
        
        try {
            CertificadoMedico certificado = certificadoMedicoService.registrarCertificado(
                    idSocio, request.getArchivoUrl(), request.getFechaEmision(), request.getObservacionesPatologias());
            return ResponseEntity.status(HttpStatus.CREATED).body(certificado);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/vigencia")
    public ResponseEntity<Map<String, Object>> chequearVigencia(@PathVariable Long idSocio) {
        boolean vigente = certificadoMedicoService.isAptoMedicoVigente(idSocio);
        return ResponseEntity.ok(Map.of(
                "idSocio", idSocio,
                "aptoMedicoVigente", vigente
        ));
    }

    @GetMapping("/actual")
    public ResponseEntity<?> obtenerCertificadoActual(@PathVariable Long idSocio) {
        return certificadoMedicoService.obtenerCertificadoActual(idSocio)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
