package com.summit.backend.controller;

import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.service.ArchivoService;
import com.summit.backend.service.CertificadoMedicoService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Certificados médicos (apto físico) de un socio.
 * Alta y descarga con permisos de SecurityConfig: escriben ADMIN y RECEPCION; consulta también PROFESOR.
 */
@RestController
@RequestMapping("/api/socios/{idSocio}/certificados")
@RequiredArgsConstructor
public class CertificadoMedicoController {

    private final CertificadoMedicoService certificadoMedicoService;
    private final ArchivoService archivoService;

    /**
     * Carga un certificado con su archivo (PDF, JPG, PNG o WEBP, máximo 5 MB).
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> registrarCertificado(
            @PathVariable Long idSocio,
            @RequestParam(value = "archivo", required = false) MultipartFile archivo,
            @RequestParam(value = "fechaEmision", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaEmision,
            @RequestParam(value = "observacionesPatologias", required = false) String observacionesPatologias,
            // Opcional: resumen de la IA que el usuario revisó en el alta o en "Cargar nuevo certificado".
            @RequestParam(value = "resumenIa", required = false) String resumenIa) {
        try {
            CertificadoMedico certificado = certificadoMedicoService.registrarCertificado(
                    idSocio, archivo, fechaEmision, observacionesPatologias, resumenIa);
            return ResponseEntity.status(HttpStatus.CREATED).body(certificado);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Corrige las patologías y el resumen del certificado: body {"observacionesPatologias": "...", "resumenIa": "..."}.
     *
     * <p>Lo usa la ficha del socio al confirmar "Analizar con IA" → "Guardar en la ficha". PATCH (y no PUT)
     * porque modifica solo dos campos del certificado. Por la regla de SecurityConfig para /api/socios/**,
     * solo ADMIN y RECEPCION pueden usarlo: el profesor consulta la ficha médica pero no la edita.</p>
     */
    @PatchMapping("/{idCertificado}")
    public ResponseEntity<?> actualizar(@PathVariable Long idSocio, @PathVariable Long idCertificado,
                                        @RequestBody Map<String, String> datos) {
        try {
            return ResponseEntity.ok(certificadoMedicoService.actualizarObservaciones(
                    idSocio, idCertificado, datos.get("observacionesPatologias"), datos.get("resumenIa")));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    @GetMapping
    public ResponseEntity<List<CertificadoMedico>> listar(@PathVariable Long idSocio) {
        return ResponseEntity.ok(certificadoMedicoService.listarPorSocio(idSocio));
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

    /**
     * Devuelve el archivo del certificado para verlo en el navegador.
     */
    @GetMapping("/{idCertificado}/archivo")
    public ResponseEntity<?> descargarArchivo(@PathVariable Long idSocio, @PathVariable Long idCertificado) {
        try {
            CertificadoMedico certificado = certificadoMedicoService.buscarDelSocio(idSocio, idCertificado);
            ArchivoService.Archivo archivo = archivoService.cargar(certificado.getArchivoUrl());
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(archivo.tipo()))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + archivo.nombre() + "\"")
                    .body(archivo.recurso());
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }
}
