package com.summit.backend.controller;

import com.summit.backend.dto.ImportacionSociosDTO;
import com.summit.backend.dto.SocioRequestDTO;
import com.summit.backend.dto.SocioResponseDTO;
import com.summit.backend.dto.SocioUpdateRequestDTO;
import com.summit.backend.service.ImportacionSociosService;
import com.summit.backend.service.SocioService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller para la gestión de Socios.
 * Exclusivo para ADMIN y RECEPCION (configurado en SecurityConfig).
 */
@RestController
@RequestMapping("/api/socios")
@RequiredArgsConstructor
public class SocioController {

    private final SocioService socioService;
    private final ImportacionSociosService importacionSociosService;

    @GetMapping
    public ResponseEntity<List<SocioResponseDTO>> listarSocios() {
        return ResponseEntity.ok(socioService.listarTodos());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SocioResponseDTO> buscarSocio(@PathVariable Long id) {
        return ResponseEntity.ok(socioService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<SocioResponseDTO> crearSocio(@Valid @RequestBody SocioRequestDTO request) {
        SocioResponseDTO nuevoSocio = socioService.crearSocio(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(nuevoSocio);
    }

    /**
     * Importa socios desde una planilla (solo ADMIN: lo exige SecurityConfig). Devuelve el resultado de cada fila:
     * CREADO, EXISTE (ese DNI ya estaba) o ERROR, con el motivo.
     */
    @PostMapping("/importar")
    public ResponseEntity<List<ImportacionSociosDTO.Resultado>> importar(@RequestBody ImportacionSociosDTO.Pedido pedido) {
        return ResponseEntity.ok(importacionSociosService.importar(pedido.filas()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SocioResponseDTO> actualizarSocio(
            @PathVariable Long id, 
            @Valid @RequestBody SocioUpdateRequestDTO request) {
        return ResponseEntity.ok(socioService.actualizarSocio(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> cancelarSocio(@PathVariable Long id) {
        socioService.cancelarSocio(id);
        return ResponseEntity.ok(Map.of("mensaje", "Socio cancelado correctamente (baja lógica)"));
    }

    @PatchMapping("/{id}/reactivar")
    public ResponseEntity<SocioResponseDTO> reactivarSocio(@PathVariable Long id) {
        return ResponseEntity.ok(socioService.reactivarSocio(id));
    }
}
