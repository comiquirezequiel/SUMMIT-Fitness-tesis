package com.summit.backend.controller;

import com.summit.backend.dto.DescuentoDTO;
import com.summit.backend.dto.DescuentoRequestDTO;
import com.summit.backend.model.ReglasMembresia;
import com.summit.backend.service.DescuentoService;
import com.summit.backend.service.ReglasMembresiaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Membresías > Descuentos y reglas: el catálogo de descuentos, la matrícula y los límites de los congelamientos.
 * Recepción los puede leer (los usa al cobrar); modificarlos es del admin (lo exige SecurityConfig para
 * /api/configuracion/**).
 */
@RestController
@RequestMapping("/api/configuracion")
@RequiredArgsConstructor
public class MembresiaConfigController {

    private final ReglasMembresiaService reglasService;
    private final DescuentoService descuentoService;

    @GetMapping("/membresias")
    public ResponseEntity<ReglasMembresia> reglas() {
        return ResponseEntity.ok(reglasService.obtener());
    }

    @PutMapping("/membresias")
    public ResponseEntity<ReglasMembresia> actualizarReglas(@RequestBody ReglasMembresia cambios) {
        return ResponseEntity.ok(reglasService.actualizar(cambios));
    }

    /** El catálogo de descuentos. ?activos=true: solo los que se ofrecen al cobrar. */
    @GetMapping("/descuentos")
    public ResponseEntity<List<DescuentoDTO>> descuentos(@RequestParam(defaultValue = "false") boolean activos) {
        return ResponseEntity.ok(descuentoService.listar(activos));
    }

    @PostMapping("/descuentos")
    public ResponseEntity<DescuentoDTO> crearDescuento(@Valid @RequestBody DescuentoRequestDTO pedido) {
        return ResponseEntity.status(HttpStatus.CREATED).body(descuentoService.crear(pedido));
    }

    @PutMapping("/descuentos/{idDescuento}")
    public ResponseEntity<DescuentoDTO> actualizarDescuento(@PathVariable Long idDescuento,
                                                            @Valid @RequestBody DescuentoRequestDTO pedido) {
        return ResponseEntity.ok(descuentoService.actualizar(idDescuento, pedido));
    }

    @DeleteMapping("/descuentos/{idDescuento}")
    public ResponseEntity<Void> eliminarDescuento(@PathVariable Long idDescuento) {
        descuentoService.eliminar(idDescuento);
        return ResponseEntity.noContent().build();
    }
}
