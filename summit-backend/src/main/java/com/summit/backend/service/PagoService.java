package com.summit.backend.service;

import com.summit.backend.dto.CajaResumenDTO;
import com.summit.backend.dto.PagoListadoDTO;
import com.summit.backend.model.EstadoPago;
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
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;

/**
 * Servicio de pagos.
 * Registra los cobros presenciales (recepción), los confirma si quedaron "a verificar" y arma la caja.
 * Regla central: solo un pago APROBADO extiende la membresía y suma como ingreso.
 */
@Service
@RequiredArgsConstructor
public class PagoService {

    // Métodos en los que la plata puede no verse acreditada en el momento: pueden quedar "a verificar"
    private static final Set<MetodoPago> VERIFICABLES = EnumSet.of(MetodoPago.TRANSFERENCIA, MetodoPago.MERCADO_PAGO);

    private final PagoHistorialRepository pagoHistorialRepository;
    private final UsuarioRepository usuarioRepository;
    private final PlanRepository planRepository;
    private final SuscripcionService suscripcionService;

    /**
     * Registra un cobro hecho en recepción.
     * Si la plata entró en el momento queda APROBADO y extiende la membresía. Si es una transferencia o un QR
     * que todavía no se ve acreditado (aVerificar), queda PENDIENTE y no extiende nada hasta que el admin lo confirme.
     * Es atómico: si falla la extensión de la suscripción, el pago no queda guardado.
     */
    @Transactional
    public PagoListadoDTO registrarPago(Long idUsuario, Long idPlan, BigDecimal monto, MetodoPago metodoPago,
                                       String comprobante, boolean aVerificar, String emailRegistrador) {
        if (monto == null || monto.signum() <= 0) {
            throw new IllegalArgumentException("El monto debe ser mayor a cero");
        }
        if (metodoPago == MetodoPago.DEBITO_AUTOMATICO) {
            throw new IllegalArgumentException("Los débitos automáticos se registran solos cuando Mercado Pago confirma el cobro");
        }
        if (aVerificar && !VERIFICABLES.contains(metodoPago)) {
            throw new IllegalArgumentException("Solo una transferencia o un pago con QR pueden quedar a verificar");
        }
        Usuario usuario = usuarioRepository.findById(idUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        Plan plan = planRepository.findById(idPlan)
                .orElseThrow(() -> new RuntimeException("Plan no encontrado"));

        PagoHistorial pago = PagoHistorial.builder()
                .usuario(usuario)
                .plan(plan)
                .montoAbonado(monto)
                .metodoPago(metodoPago)
                .comprobanteNro(comprobante)
                .estadoPago(aVerificar ? EstadoPago.PENDIENTE : EstadoPago.APROBADO)
                .registradoPor(usuarioPorEmail(emailRegistrador))
                .build();
        PagoHistorial pagoGuardado = pagoHistorialRepository.save(pago);

        if (pagoGuardado.getEstadoPago() == EstadoPago.APROBADO) {
            suscripcionService.extenderOcrearSuscripcion(usuario, plan);
        }
        return aDto(pagoGuardado);
    }

    /**
     * El admin confirma (o rechaza) un pago que quedó "a verificar".
     * Recién al aprobarlo se extiende la membresía. Queda registrado quién lo verificó y cuándo.
     */
    @Transactional
    public PagoListadoDTO verificarPago(Long idPago, boolean aprobado, String emailVerificador) {
        PagoHistorial pago = pagoHistorialRepository.findParaActualizar(idPago)
                .orElseThrow(() -> new NoSuchElementException("No existe el pago " + idPago));
        if (pago.getEstadoPago() != EstadoPago.PENDIENTE) {
            throw new IllegalStateException("Ese pago ya fue " +
                    (pago.getEstadoPago() == EstadoPago.APROBADO ? "aprobado" : "rechazado"));
        }
        pago.setEstadoPago(aprobado ? EstadoPago.APROBADO : EstadoPago.RECHAZADO);
        pago.setVerificadoPor(usuarioPorEmail(emailVerificador));
        pago.setFechaVerificacion(LocalDateTime.now());
        if (aprobado) {
            suscripcionService.extenderOcrearSuscripcion(pago.getUsuario(), pago.getPlan());
        }
        return aDto(pagoHistorialRepository.save(pago));
    }

    /**
     * Historial de pagos de un socio ordenado por fecha descendente.
     */
    @Transactional(readOnly = true)
    public List<PagoListadoDTO> historialPorSocio(Long idUsuario) {
        return pagoHistorialRepository.findByUsuarioIdUsuarioOrderByFechaPagoDesc(idUsuario).stream()
                .map(this::aDto)
                .toList();
    }

    /**
     * Listado de caja paginado (el orden lo define el Pageable, por defecto el más reciente primero).
     * Con estado, filtra (ej. PENDIENTE = los que faltan verificar).
     */
    @Transactional(readOnly = true)
    public Page<PagoListadoDTO> listar(EstadoPago estado, Pageable pageable) {
        Page<PagoHistorial> pagos = estado == null
                ? pagoHistorialRepository.findAll(pageable)
                : pagoHistorialRepository.findByEstadoPago(estado, pageable);
        return pagos.map(this::aDto);
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
                .cobrosHoy(pagoHistorialRepository.countByEstadoPagoAndFechaPagoGreaterThanEqual(EstadoPago.APROBADO, inicioDia))
                .ingresosHoyPorMetodo(porMetodo)
                .ingresosMes(pagoHistorialRepository.sumarDesde(inicioMes))
                .cobrosMes(pagoHistorialRepository.countByEstadoPagoAndFechaPagoGreaterThanEqual(EstadoPago.APROBADO, inicioMes))
                .pendientesVerificar(pagoHistorialRepository.countByEstadoPago(EstadoPago.PENDIENTE))
                .montoPendienteVerificar(pagoHistorialRepository.sumarPorEstado(EstadoPago.PENDIENTE))
                .build();
    }

    PagoListadoDTO aDto(PagoHistorial p) {
        return PagoListadoDTO.builder()
                .idPago(p.getIdPago())
                .fechaPago(p.getFechaPago())
                .idSocio(p.getUsuario().getIdUsuario())
                .nombreSocio(p.getUsuario().getNombreCompleto())
                .dniSocio(p.getUsuario().getDni())
                .plan(p.getPlan().getNombrePlan())
                .monto(p.getMontoAbonado())
                .metodoPago(p.getMetodoPago().name())
                .comprobante(p.getComprobanteNro())
                .estado(p.getEstadoPago().name())
                .registradoPor(p.getRegistradoPor() != null ? p.getRegistradoPor().getNombreCompleto() : null)
                .verificadoPor(p.getVerificadoPor() != null ? p.getVerificadoPor().getNombreCompleto() : null)
                .fechaVerificacion(p.getFechaVerificacion())
                .build();
    }

    // El empleado logueado (por el email del token); null si no se encuentra
    private Usuario usuarioPorEmail(String email) {
        return email == null ? null : usuarioRepository.findByEmail(email).orElse(null);
    }
}
