package com.summit.backend.controller;

import com.summit.backend.dto.ComprobanteFiscalDTO;
import com.summit.backend.dto.DatosFiscalesDTO;
import com.summit.backend.dto.EstadoFacturacionDTO;
import com.summit.backend.dto.PruebaConexionDTO;
import com.summit.backend.model.EstadoComprobante;
import com.summit.backend.service.DatosFiscalesService;
import com.summit.backend.service.FacturacionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Factura electrónica de ARCA. Ver, recepción y admin; datos fiscales, probar la conexión, anular, reintentar y
 * facturar a mano, solo el admin (SecurityConfig). Con la facturación apagada responde 409.
 */
@RestController
@RequestMapping("/api/facturacion")
@RequiredArgsConstructor
public class FacturacionController {

    private final FacturacionService facturacionService;
    private final DatosFiscalesService datosFiscalesService;

    @GetMapping("/estado")
    public ResponseEntity<EstadoFacturacionDTO> estado() {
        return ResponseEntity.ok(facturacionService.estado());
    }

    @GetMapping("/datos-fiscales")
    public ResponseEntity<DatosFiscalesDTO> datosFiscales() {
        return ResponseEntity.ok(datosFiscalesService.dto());
    }

    /** Al guardarlos, lo que esperaba por falta de datos se manda enseguida. */
    @PutMapping("/datos-fiscales")
    public ResponseEntity<DatosFiscalesDTO> guardarDatosFiscales(@RequestBody DatosFiscalesDTO pedido) {
        DatosFiscalesDTO guardados = datosFiscalesService.guardar(pedido);
        if (facturacionService.habilitada()) {
            facturacionService.procesarAhora();
        }
        return ResponseEntity.ok(guardados);
    }

    @PostMapping("/probar-conexion")
    public ResponseEntity<PruebaConexionDTO> probarConexion() {
        return ResponseEntity.ok(facturacionService.probarConexion());
    }

    /** ?estado=RECHAZADO filtra; por defecto, los más nuevos primero. */
    @GetMapping("/comprobantes")
    public ResponseEntity<Page<ComprobanteFiscalDTO>> comprobantes(
            @RequestParam(required = false) EstadoComprobante estado,
            @PageableDefault(size = 20, sort = "idComprobante", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(facturacionService.listar(estado, pageable));
    }

    @GetMapping("/comprobantes/{id}")
    public ResponseEntity<ComprobanteFiscalDTO> comprobante(@PathVariable Long id) {
        return ResponseEntity.ok(facturacionService.detalle(id));
    }

    @GetMapping("/pagos/{idPago}")
    public ResponseEntity<List<ComprobanteFiscalDTO>> dePago(@PathVariable Long idPago) {
        return ResponseEntity.ok(facturacionService.dePago(idPago));
    }

    /** Body: {"conDni": true} para que salga a nombre del socio. */
    @PostMapping("/pagos/{idPago}/facturar")
    public ResponseEntity<ComprobanteFiscalDTO> facturar(@PathVariable Long idPago,
                                                         @RequestBody(required = false) Map<String, Boolean> pedido,
                                                         Authentication auth) {
        boolean conDni = pedido != null && Boolean.TRUE.equals(pedido.get("conDni"));
        return ResponseEntity.status(HttpStatus.CREATED).body(facturacionService.facturar(idPago, conDni, auth.getName()));
    }

    /** Body: {"motivo": "..."}. Emite la nota de crédito por el total. */
    @PostMapping("/comprobantes/{id}/anular")
    public ResponseEntity<ComprobanteFiscalDTO> anular(@PathVariable Long id, @RequestBody Map<String, String> pedido,
                                                       Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(facturacionService.anular(id, pedido.get("motivo"), auth.getName()));
    }

    @PostMapping("/comprobantes/{id}/reintentar")
    public ResponseEntity<ComprobanteFiscalDTO> reintentar(@PathVariable Long id) {
        return ResponseEntity.ok(facturacionService.reintentar(id));
    }

    /** Lo que espera un reintento se manda ya. */
    @PostMapping("/procesar")
    public ResponseEntity<Void> procesar() {
        facturacionService.procesarAhora();
        return ResponseEntity.noContent().build();
    }
}
