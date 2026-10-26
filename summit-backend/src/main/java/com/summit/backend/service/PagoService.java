package com.summit.backend.service;

import com.summit.backend.dto.CajaResumenDTO;
import com.summit.backend.dto.CobroRequestDTO;
import com.summit.backend.dto.PagoListadoDTO;
import com.summit.backend.dto.PresupuestoDTO;
import com.summit.backend.model.Descuento;
import com.summit.backend.model.EstadoPago;
import com.summit.backend.model.MetodoPago;
import com.summit.backend.model.PagoHistorial;
import com.summit.backend.model.Plan;
import com.summit.backend.model.ReglasMembresia;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.GastoRepository;
import com.summit.backend.repository.PagoHistorialRepository;
import com.summit.backend.repository.PlanRepository;
import com.summit.backend.repository.SuscripcionRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;

import static com.summit.backend.service.TextoMontos.pesos;

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
    // Un cobro a verificar de estos últimos días que ya incluye la matrícula evita cobrarla dos veces. Uno más viejo
    // sin resolver no cuenta (es un cobro que quedó olvidado en la caja)
    private static final int DIAS_COBRO_A_VERIFICAR_CON_MATRICULA = 30;

    /** El total que vio recepción ya no es el que corresponde (cambió un precio, la matrícula o un descuento). */
    public static class TotalCambiadoException extends RuntimeException {
        public TotalCambiadoException(String mensaje) {
            super(mensaje);
        }
    }

    private final PagoHistorialRepository pagoHistorialRepository;
    private final GastoRepository gastoRepository;
    private final UsuarioRepository usuarioRepository;
    private final PlanRepository planRepository;
    private final SuscripcionRepository suscripcionRepository;
    private final SuscripcionService suscripcionService;
    private final DescuentoService descuentoService;
    private final ReglasMembresiaService reglasMembresiaService;

    /**
     * Detalle de un cobro antes de confirmarlo, con el mismo cálculo que registrarPago. Sin socio = socio nuevo
     * (el alta todavía no se guardó).
     */
    @Transactional(readOnly = true)
    public PresupuestoDTO presupuesto(CobroRequestDTO pedido) {
        Usuario socio = pedido.getIdUsuario() == null ? null : buscarUsuario(pedido.getIdUsuario());
        return calcular(socio, buscarPlan(pedido.getIdPlan()), pedido);
    }

    /**
     * Registra un cobro hecho en recepción. El total lo calcula el backend: precio del plan - descuento + matrícula.
     * Si la plata entró en el momento queda APROBADO y extiende la membresía. Si es una transferencia o un QR
     * que todavía no se ve acreditado (aVerificar), queda PENDIENTE y no extiende nada hasta que el admin lo confirme.
     * Es atómico: si falla la extensión de la suscripción, el pago no queda guardado.
     *
     * @throws TotalCambiadoException si el total que vio recepción (totalMostrado, obligatorio) ya no es el que
     *                                corresponde
     */
    @Transactional
    public PagoListadoDTO registrarPago(CobroRequestDTO pedido, String emailRegistrador) {
        if (pedido.getIdUsuario() == null) {
            throw new IllegalArgumentException("Falta el socio");
        }
        MetodoPago metodoPago = metodoPago(pedido.getMetodoPago());
        if (metodoPago == MetodoPago.DEBITO_AUTOMATICO) {
            throw new IllegalArgumentException("Los débitos automáticos se registran solos cuando Mercado Pago confirma el cobro");
        }
        boolean aVerificar = pedido.isAVerificar();
        if (aVerificar && !VERIFICABLES.contains(metodoPago)) {
            throw new IllegalArgumentException("Solo una transferencia o un pago con QR pueden quedar a verificar");
        }
        String comprobante = pedido.getComprobante() == null ? "" : pedido.getComprobante().trim();
        if (comprobante.length() > 50) {
            throw new IllegalArgumentException("El número de comprobante no puede superar los 50 caracteres");
        }
        Usuario usuario = buscarUsuario(pedido.getIdUsuario());
        Plan plan = buscarPlan(pedido.getIdPlan());

        PresupuestoDTO detalle = calcular(usuario, plan, pedido);
        if (pedido.getTotalMostrado() == null) {
            throw new IllegalArgumentException("Falta el total que se le mostró a recepción: volvé a calcular el cobro");
        }
        if (pedido.getTotalMostrado().compareTo(detalle.getTotal()) != 0) {
            throw new TotalCambiadoException("El total cambió: ahora es " + pesos(detalle.getTotal())
                    + ". Revisá el detalle y confirmá de nuevo");
        }
        if (aVerificar && detalle.getTotal().signum() == 0) {
            throw new IllegalArgumentException("Un cobro sin monto no puede quedar a verificar");
        }

        PagoHistorial pago = PagoHistorial.builder()
                .usuario(usuario)
                .plan(plan)
                .montoAbonado(detalle.getTotal())
                .metodoPago(metodoPago)
                .comprobanteNro(comprobante)
                .estadoPago(aVerificar ? EstadoPago.PENDIENTE : EstadoPago.APROBADO)
                .registradoPor(usuarioPorEmail(emailRegistrador))
                .precioLista(detalle.getPrecioLista())
                .descuentoNombre(detalle.getDescuentoNombre())
                .descuentoMonto(detalle.getDescuentoNombre() != null ? detalle.getDescuentoMonto() : null)
                .matriculaMonto(!detalle.isMatriculaCorresponde() ? null
                        : detalle.isMatriculaBonificada() ? BigDecimal.ZERO : detalle.getMatriculaMonto())
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
     * Cobro mensual confirmado por Mercado Pago (débito automático): entra APROBADO y extiende la membresía.
     * El id de Mercado Pago es único: si ese cobro ya se registró, no hace nada y devuelve false
     * (la sincronización puede ver el mismo cobro muchas veces).
     */
    @Transactional
    public boolean registrarCobroAutomatico(Usuario usuario, Plan plan, BigDecimal monto, String mpPaymentId,
                                            LocalDateTime fechaCobro) {
        if (pagoHistorialRepository.existsByMpPaymentId(mpPaymentId)) {
            return false;
        }
        pagoHistorialRepository.save(PagoHistorial.builder()
                .usuario(usuario)
                .plan(plan)
                .montoAbonado(monto)
                .metodoPago(MetodoPago.DEBITO_AUTOMATICO)
                .comprobanteNro("MP " + mpPaymentId)
                .estadoPago(EstadoPago.APROBADO)
                .mpPaymentId(mpPaymentId)
                .fechaPago(fechaCobro)
                .build());
        suscripcionService.extenderOcrearSuscripcion(usuario, plan);
        return true;
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
                .egresosHoy(gastoRepository.sumarDesde(inicioDia))
                .gastosHoy(gastoRepository.countByAnuladoFalseAndFechaGreaterThanEqual(inicioDia))
                .egresosMes(gastoRepository.sumarDesde(inicioMes))
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
                .precioLista(p.getPrecioLista())
                .descuentoNombre(p.getDescuentoNombre())
                .descuentoMonto(p.getDescuentoMonto())
                .matriculaMonto(p.getMatriculaMonto())
                .build();
    }

    // Precio del plan - descuento (uno del catálogo o uno especial con motivo) + matrícula si corresponde
    private PresupuestoDTO calcular(Usuario socio, Plan plan, CobroRequestDTO pedido) {
        BigDecimal precio = plan.getPrecioBase().setScale(2, RoundingMode.HALF_UP);
        CobroRequestDTO.DescuentoEspecial especial = pedido.getDescuentoEspecial();
        if (pedido.getIdDescuento() != null && especial != null) {
            throw new IllegalArgumentException("Elegí un descuento del listado o uno especial, no los dos");
        }
        Long idDescuento = null;
        String descuentoNombre = null;
        BigDecimal descuentoMonto = BigDecimal.ZERO.setScale(2);
        if (pedido.getIdDescuento() != null) {
            Descuento descuento = descuentoService.activo(pedido.getIdDescuento());
            idDescuento = descuento.getIdDescuento();
            descuentoNombre = descuento.getNombre();
            descuentoMonto = DescuentoService.montoSobre(descuento, precio);
        } else if (especial != null) {
            String motivo = especial.getMotivo() == null ? "" : especial.getMotivo().trim();
            if (motivo.length() < 3) {
                throw new IllegalArgumentException("Escribí el motivo del descuento especial (queda registrado)");
            }
            if (motivo.length() > 100) {
                throw new IllegalArgumentException("El motivo del descuento no puede superar los 100 caracteres");
            }
            BigDecimal monto = especial.getMonto();
            if (monto == null || monto.signum() <= 0) {
                throw new IllegalArgumentException("El descuento especial tiene que ser mayor a cero");
            }
            if (monto.compareTo(precio) > 0) {
                throw new IllegalArgumentException("El descuento no puede superar el precio del plan (" + pesos(precio) + ")");
            }
            descuentoNombre = "Especial: " + motivo;
            descuentoMonto = monto.setScale(2, RoundingMode.HALF_UP);
        }

        Matricula matricula = matricula(socio);
        boolean bonificada = matricula.corresponde() && pedido.isBonificarMatricula();
        BigDecimal matriculaCobrada = matricula.corresponde() && !bonificada ? matricula.monto() : BigDecimal.ZERO;
        return PresupuestoDTO.builder()
                .idPlan(plan.getIdPlan())
                .plan(plan.getNombrePlan())
                .precioLista(precio)
                .idDescuento(idDescuento)
                .descuentoNombre(descuentoNombre)
                .descuentoMonto(descuentoMonto)
                .matriculaCorresponde(matricula.corresponde())
                .matriculaMotivo(matricula.motivo())
                .matriculaMonto(matricula.monto())
                .matriculaBonificada(bonificada)
                .total(precio.subtract(descuentoMonto).add(matriculaCobrada).setScale(2, RoundingMode.HALF_UP))
                .build();
    }

    private record Matricula(boolean corresponde, String motivo, BigDecimal monto) {}

    /**
     * Si corresponde cobrarle matrícula a un socio (null = socio nuevo): en la primera inscripción, y otra vez si
     * estuvo más días sin cuota que los de las reglas de membresía.
     */
    private Matricula matricula(Usuario socio) {
        ReglasMembresia reglas = reglasMembresiaService.obtener();
        BigDecimal monto = reglas.getMatriculaMonto().setScale(2, RoundingMode.HALF_UP);
        Matricula noCorresponde = new Matricula(false, null, monto);
        if (monto.signum() <= 0) {
            return noCorresponde;
        }
        if (socio == null) {
            return new Matricula(true, "Inscripción", monto);
        }
        // Ya la resolvió (cobrada o bonificada) un cobro reciente que quedó a verificar: no se cobra dos veces
        if (pagoHistorialRepository.existsByUsuarioIdUsuarioAndEstadoPagoAndMatriculaMontoIsNotNullAndFechaPagoAfter(
                socio.getIdUsuario(), EstadoPago.PENDIENTE, LocalDateTime.now().minusDays(DIAS_COBRO_A_VERIFICAR_CON_MATRICULA))) {
            return noCorresponde;
        }
        LocalDate ultimoVencimiento = suscripcionRepository.ultimoVencimiento(socio.getIdUsuario());
        if (ultimoVencimiento == null) {
            return new Matricula(true, "Inscripción", monto);
        }
        long sinCuota = ChronoUnit.DAYS.between(ultimoVencimiento, LocalDate.now());
        int limite = reglas.getMatriculaReinscripcionDias();
        if (limite > 0 && sinCuota > limite) {
            return new Matricula(true, "Reinscripción: estuvo " + sinCuota + " días sin cuota (venció el "
                    + TextoFechas.completa(ultimoVencimiento) + ")", monto);
        }
        return noCorresponde;
    }

    private Usuario buscarUsuario(Long idUsuario) {
        return usuarioRepository.findById(idUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
    }

    private Plan buscarPlan(Long idPlan) {
        if (idPlan == null) {
            throw new IllegalArgumentException("Elegí un plan");
        }
        return planRepository.findById(idPlan)
                .orElseThrow(() -> new RuntimeException("Plan no encontrado"));
    }

    private static MetodoPago metodoPago(String valor) {
        if (valor == null || valor.isBlank()) {
            throw new IllegalArgumentException("Elegí el medio de pago");
        }
        try {
            return MetodoPago.valueOf(valor.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Medio de pago desconocido: " + valor);
        }
    }

    // El empleado logueado (por el email del token); null si no se encuentra
    private Usuario usuarioPorEmail(String email) {
        return email == null ? null : usuarioRepository.findByEmail(email).orElse(null);
    }
}
