package com.summit.backend.controller;

import com.summit.backend.dto.CongelamientoDTO;
import com.summit.backend.dto.CongelamientoRequestDTO;
import com.summit.backend.service.CongelamientoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Congelamientos de la membresía de un socio (desde su ficha). Los registran recepción y el admin
 * (SecurityConfig: /api/socios/**).
 */
@RestController
@RequestMapping("/api/socios/{idSocio}/congelamientos")
@RequiredArgsConstructor
public class CongelamientoController {

    private final CongelamientoService congelamientoService;

    @GetMapping
    public ResponseEntity<List<CongelamientoDTO>> historial(@PathVariable Long idSocio) {
        return ResponseEntity.ok(congelamientoService.historial(idSocio));
    }

    @PostMapping
    public ResponseEntity<CongelamientoDTO> registrar(@PathVariable Long idSocio,
                                                      @Valid @RequestBody CongelamientoRequestDTO pedido,
                                                      Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(congelamientoService.registrar(idSocio, pedido, auth.getName()));
    }

    /** Volvió antes: termina el congelamiento ayer (o lo anula si todavía no empezó) y descuenta los días que no usó. */
    @PostMapping("/{idCongelamiento}/terminar")
    public ResponseEntity<CongelamientoDTO> terminar(@PathVariable Long idSocio, @PathVariable Long idCongelamiento) {
        return ResponseEntity.ok(congelamientoService.terminar(idSocio, idCongelamiento));
    }
}
