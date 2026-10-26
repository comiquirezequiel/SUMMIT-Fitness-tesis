package com.summit.backend.controller;

import com.summit.backend.dto.CierreCajaDTO;
import com.summit.backend.dto.CierreRequestDTO;
import com.summit.backend.dto.GastoDTO;
import com.summit.backend.dto.GastoRequestDTO;
import com.summit.backend.dto.TurnoCajaDTO;
import com.summit.backend.service.CajaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Caja de recepción: el turno abierto, su cierre (arqueo) y los gastos. ADMIN y RECEPCION (SecurityConfig).
 */
@RestController
@RequestMapping("/api/caja")
@RequiredArgsConstructor
public class CajaController {

    private final CajaService cajaService;

    @GetMapping("/turno")
    public ResponseEntity<TurnoCajaDTO> turno() {
        return ResponseEntity.ok(cajaService.turnoActual());
    }

    @PostMapping("/cierres")
    public ResponseEntity<CierreCajaDTO> cerrar(@Valid @RequestBody CierreRequestDTO pedido, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cajaService.cerrar(pedido, auth.getName()));
    }

    @GetMapping("/cierres")
    public ResponseEntity<Page<CierreCajaDTO>> cierres(
            @PageableDefault(size = 10, sort = "hasta", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(cajaService.listarCierres(pageable));
    }

    @GetMapping("/gastos")
    public ResponseEntity<Page<GastoDTO>> gastos(
            @PageableDefault(size = 15, sort = "fecha", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(cajaService.listarGastos(pageable));
    }

    @PostMapping("/gastos")
    public ResponseEntity<GastoDTO> registrarGasto(@Valid @RequestBody GastoRequestDTO pedido, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cajaService.registrarGasto(pedido, auth.getName()));
    }

    /** Body: {"motivo": "..."} */
    @PostMapping("/gastos/{idGasto}/anular")
    public ResponseEntity<GastoDTO> anularGasto(@PathVariable Long idGasto, @RequestBody Map<String, String> pedido,
                                                Authentication auth) {
        return ResponseEntity.ok(cajaService.anularGasto(idGasto, pedido.get("motivo"), auth.getName()));
    }
}
