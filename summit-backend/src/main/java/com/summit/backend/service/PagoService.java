package com.summit.backend.service;

import com.summit.backend.dto.CajaResumenDTO;
import com.summit.backend.dto.PagoListadoDTO;
import com.summit.backend.model.MetodoPago;
import com.summit.backend.model.PagoHistorial;
import com.summit.backend.model.Plan;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.PagoHistorialRepository;
import com.summit.backend.repository.PlanRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
        if (monto == null || monto.signum() <= 0) {
            throw new IllegalArgumentException("El monto debe ser mayor a cero");
        }
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

    /**
     * Listado de caja paginado (el orden lo define el Pageable, por defecto el más reciente primero).
     */
    public Page<PagoListadoDTO> listar(Pageable pageable) {
        return pagoHistorialRepository.findAll(pageable).map(p -> PagoListadoDTO.builder()
                .idPago(p.getIdPago())
                .fechaPago(p.getFechaPago())
                .idSocio(p.getUsuario().getIdUsuario())
                .nombreSocio(p.getUsuario().getNombreCompleto())
                .dniSocio(p.getUsuario().getDni())
                .plan(p.getPlan().getNombrePlan())
                .monto(p.getMontoAbonado())
                .metodoPago(p.getMetodoPago().name())
                .comprobante(p.getComprobanteNro())
                .build());
    }

    public CajaResumenDTO resumen() {
        LocalDate hoy = LocalDate.now();
        LocalDateTime inicioDia = hoy.atStartOfDay();
        LocalDateTime inicioMes = hoy.withDayOfMonth(1).atStartOfDay();

        Map<String, BigDecimal> porMetodo = new LinkedHashMap<>();
        for (Object[] fila : pagoHistorialRepository.sumarPorMetodoDesde(inicioDia)) {
            porMetodo.put(((MetodoPago) fila[0]).name(), (BigDecimal) fila[1]);
        }

        return CajaResumenDTO.builder()
                .ingresosHoy(pagoHistorialRepository.sumarDesde(inicioDia))
                .cobrosHoy(pagoHistorialRepository.countByFechaPagoGreaterThanEqual(inicioDia))
                .ingresosHoyPorMetodo(porMetodo)
                .ingresosMes(pagoHistorialRepository.sumarDesde(inicioMes))
                .cobrosMes(pagoHistorialRepository.countByFechaPagoGreaterThanEqual(inicioMes))
                .build();
    }
}
