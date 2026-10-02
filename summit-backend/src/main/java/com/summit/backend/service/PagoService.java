package com.summit.backend.service;

import com.summit.backend.model.MetodoPago;
import com.summit.backend.model.PagoHistorial;
import com.summit.backend.model.Plan;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.PagoHistorialRepository;
import com.summit.backend.repository.PlanRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Servicio de pagos.
 * Registra cobros y provee historial paginado por socio.
 */
@Service
@RequiredArgsConstructor
public class PagoService {

    private final PagoHistorialRepository pagoHistorialRepository;
    private final UsuarioRepository usuarioRepository;
    private final PlanRepository planRepository;
    private final SuscripcionService suscripcionService;

    /**
     * Registra un nuevo pago y extiende automáticamente la suscripción del socio.
     * Es atómico: si falla la extensión de la suscripción, el pago no queda guardado.
     */
    @Transactional
    public PagoHistorial registrarPago(Long idUsuario, Long idPlan, BigDecimal monto,
                                        MetodoPago metodoPago, String comprobante) {
        Usuario usuario = usuarioRepository.findById(idUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        Plan plan = planRepository.findById(idPlan)
                .orElseThrow(() -> new RuntimeException("Plan no encontrado"));

        // 1. Guardar el pago
        PagoHistorial pago = PagoHistorial.builder()
                .usuario(usuario)
                .plan(plan)
                .montoAbonado(monto)
                .metodoPago(metodoPago)
                .comprobanteNro(comprobante)
                .build();
        PagoHistorial pagoGuardado = pagoHistorialRepository.save(pago);

        // 2. Extender membresía
        suscripcionService.extenderOcrearSuscripcion(usuario, plan);

        return pagoGuardado;
    }

    /**
     * Historial de pagos de un socio ordenado por fecha descendente.
     */
    public List<PagoHistorial> historialPorSocio(Long idUsuario) {
        return pagoHistorialRepository.findByUsuarioIdUsuarioOrderByFechaPagoDesc(idUsuario);
    }
}
