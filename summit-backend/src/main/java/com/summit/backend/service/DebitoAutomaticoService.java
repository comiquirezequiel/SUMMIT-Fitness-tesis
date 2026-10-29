package com.summit.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.summit.backend.dto.DebitoAutomaticoDTO;
import com.summit.backend.model.DebitoAutomatico;
import com.summit.backend.model.EstadoDebito;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Plan;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.DebitoAutomaticoRepository;
import com.summit.backend.repository.PlanRepository;
import com.summit.backend.repository.UsuarioRepository;
import com.summit.backend.service.MercadoPagoClient.MercadoPagoNoDisponibleException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.concurrent.Semaphore;
import java.util.regex.Pattern;

/**
 * Débito automático mensual (opcional para el socio) con Mercado Pago Suscripciones.
 *
 * <p><b>Alta:</b> recepción elige el plan (y muestra un QR con el link); se crea la suscripción en
 * Mercado Pago y el socio la autoriza en el link eligiendo con qué pagar: dinero en cuenta de Mercado Pago o
 * cualquier tarjeta de débito, crédito o prepaga (las de Ualá, Naranja X, Banco Nación, etc.).</p>
 *
 * <p><b>Cobros:</b> Mercado Pago cobra solo cada mes. Una tarea programada le consulta cada hora qué cobró
 * (no hace falta que el sistema esté publicado en internet) y cada cobro aprobado se registra como pago y
 * extiende la membresía. Si un cobro se rechaza, la membresía vence como siempre y recepción ve la alerta.</p>
 *
 * <p><b>Baja:</b> con un clic desde recepción (Defensa del Consumidor: la baja tiene que poder hacerse por el
 * mismo medio que el alta). Solo se marca la baja si Mercado Pago la confirma: si no, seguiría
 * cobrando.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DebitoAutomaticoService {

    // Adhesiones que todavía pueden cobrar (o están por empezar a cobrar)
    private static final List<EstadoDebito> VIGENTES =
            List.of(EstadoDebito.PENDIENTE_AUTORIZACION, EstadoDebito.ACTIVO, EstadoDebito.PAUSADO);
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final DebitoAutomaticoRepository debitoRepository;
    private final UsuarioRepository usuarioRepository;
    private final PlanRepository planRepository;
    private final PagoService pagoService;
    private final MercadoPagoClient mercadoPago;
    // Cada adhesión se sincroniza en su propia transacción: si una falla, las demás se guardan igual
    private final TransactionTemplate transaccion;

    // Una sincronización a la vez: la programada y la del botón "Actualizar" no se pisan
    private final Semaphore sincronizando = new Semaphore(1);

    /** Estado del débito de un socio para su ficha (debito = null si nunca se adhirió). */
    public record EstadoDebitoSocio(boolean habilitado, DebitoAutomaticoDTO debito) {
    }

    /** Resumen de una sincronización con Mercado Pago. */
    public record ResultadoSincronizacion(int revisados, int cobrosNuevos, int errores, boolean enCurso) {
    }

    public boolean habilitado() {
        return mercadoPago.habilitado();
    }

    @Transactional(readOnly = true)
    public List<DebitoAutomaticoDTO> listar(EstadoDebito estado) {
        List<DebitoAutomatico> lista = estado == null
                ? debitoRepository.findAllByOrderByFechaAltaDesc()
                : debitoRepository.findByEstadoInOrderByFechaAltaDesc(List.of(estado));
        return lista.stream().map(this::aDto).toList();
    }

    @Transactional(readOnly = true)
    public EstadoDebitoSocio delSocio(Long idSocio) {
        return new EstadoDebitoSocio(mercadoPago.habilitado(),
                debitoRepository.findFirstByUsuarioIdUsuarioOrderByFechaAltaDesc(idSocio).map(this::aDto).orElse(null));
    }

    /**
     * Crea la adhesión y la suscripción en Mercado Pago. Devuelve el link de autorización (el QR de recepción).
     * Si el socio tenía una adhesión que nunca autorizó, se reemplaza; si tiene una activa, primero hay que darla de baja.
     */
    @Transactional
    public DebitoAutomaticoDTO adherir(Long idSocio, Long idPlan, String emailPagador, String emailQuienDaDeAlta) {
        if (!mercadoPago.habilitado()) {
            throw new MercadoPagoNoDisponibleException(
                    "El débito automático no está configurado: falta la credencial de Mercado Pago (variable MP_ACCESS_TOKEN)");
        }
        Usuario socio = usuarioRepository.findById(idSocio)
                .orElseThrow(() -> new NoSuchElementException("No existe el socio " + idSocio));
        if (socio.getRol() != Rol.SOCIO) {
            throw new IllegalArgumentException("El débito automático es solo para socios");
        }
        if (socio.getEstado() == EstadoUsuario.CANCELADO) {
            throw new IllegalArgumentException("El socio está dado de baja");
        }
        Plan plan = planRepository.findById(idPlan)
                .orElseThrow(() -> new NoSuchElementException("No existe el plan " + idPlan));
        if (!Boolean.TRUE.equals(plan.getActivo())) {
            throw new IllegalArgumentException("El plan " + plan.getNombrePlan() + " no está activo");
        }
        if (plan.getPrecioBase() == null || plan.getPrecioBase().signum() <= 0) {
            throw new IllegalArgumentException("El plan " + plan.getNombrePlan() + " no tiene precio");
        }
        int meses = mesesDelPlan(plan);
        String email = (emailPagador == null || emailPagador.isBlank() ? socio.getEmail() : emailPagador).trim().toLowerCase();
        if (!EMAIL.matcher(email).matches()) {
            throw new IllegalArgumentException("El email de la cuenta de Mercado Pago no es válido");
        }

        Optional<DebitoAutomatico> vigente =
                debitoRepository.findFirstByUsuarioIdUsuarioAndEstadoInOrderByFechaAltaDesc(idSocio, VIGENTES);
        if (vigente.isPresent()) {
            DebitoAutomatico anterior = vigente.get();
            if (anterior.getEstado() != EstadoDebito.PENDIENTE_AUTORIZACION) {
                throw new IllegalStateException("El socio ya tiene un débito automático "
                        + (anterior.getEstado() == EstadoDebito.ACTIVO ? "activo" : "pausado")
                        + " (" + anterior.getPlan().getNombrePlan() + "). Para cambiar de plan, primero dalo de baja.");
            }
            // Nunca se autorizó: se reemplaza por el nuevo
            cancelarEnMercadoPago(anterior);
            marcarBaja(anterior, emailQuienDaDeAlta);
        }

        DebitoAutomatico debito = debitoRepository.save(DebitoAutomatico.builder()
                .usuario(socio)
                .plan(plan)
                .monto(plan.getPrecioBase())
                .estado(EstadoDebito.PENDIENTE_AUTORIZACION)
                .emailPagador(email)
                .creadoPor(usuarioPorEmail(emailQuienDaDeAlta))
                .build());

        JsonNode suscripcion = mercadoPago.crearSuscripcion(email, "SUMMIT Fitness - " + plan.getNombrePlan(),
                "SUMMIT-DEB-" + debito.getIdDebito(), plan.getPrecioBase(), meses);
        debito.setMpPreapprovalId(suscripcion.path("id").asText(null));
        debito.setLinkAutorizacion(suscripcion.path("init_point").asText(null));
        if (debito.getMpPreapprovalId() == null || debito.getLinkAutorizacion() == null) {
            // Excepción → se deshace la transacción: no queda una adhesión sin link
            throw new MercadoPagoNoDisponibleException("Mercado Pago no devolvió el link de autorización: probá de nuevo");
        }
        return aDto(debitoRepository.save(debito));
    }

    @Transactional
    public DebitoAutomaticoDTO darDeBaja(Long idDebito, String emailQuien) {
        DebitoAutomatico debito = debitoRepository.findById(idDebito)
                .orElseThrow(() -> new NoSuchElementException("No existe el débito automático " + idDebito));
        return aDto(baja(debito, emailQuien));
    }

    /**
     * Cuando el admin cambia el precio de un plan, se actualiza el monto de las adhesiones vigentes de ese plan
     * (rige desde el próximo cobro). Si Mercado Pago no responde para alguna, queda en el log y no frena el cambio.
     *
     * @return cuántas adhesiones se actualizaron
     */
    public int actualizarMontoDelPlan(Long idPlan, BigDecimal nuevoMonto) {
        int actualizadas = 0;
        for (DebitoAutomatico debito : debitoRepository.findByPlanIdPlanAndEstadoIn(idPlan, VIGENTES)) {
            try {
                if (debito.getMpPreapprovalId() != null) {
                    mercadoPago.actualizarMonto(debito.getMpPreapprovalId(), nuevoMonto);
                }
                debito.setMonto(nuevoMonto);
                debitoRepository.save(debito);
                actualizadas++;
            } catch (RuntimeException e) {
                log.warn("No se pudo actualizar el monto del débito automático {}: {}", debito.getIdDebito(), e.getMessage());
            }
        }
        return actualizadas;
    }

    // ---------- Sincronización con Mercado Pago ----------

    /** Cada hora (configurable), sin intervención de nadie. Sin credencial no hace nada. */
    @Scheduled(fixedDelayString = "${summit.pagos.mp.sincronizar-ms:3600000}", initialDelay = 120_000)
    public void sincronizarProgramado() {
        if (!mercadoPago.habilitado()) {
            return;
        }
        ResultadoSincronizacion resultado = sincronizarTodos();
        if (resultado.cobrosNuevos() > 0 || resultado.errores() > 0) {
            log.info("Débitos automáticos: {} revisados, {} cobros nuevos, {} con error",
                    resultado.revisados(), resultado.cobrosNuevos(), resultado.errores());
        }
    }

    /** Botón "Sincronizar ahora" de recepción: revisa todas las adhesiones vigentes. */
    public ResultadoSincronizacion sincronizarTodos() {
        if (!mercadoPago.habilitado()) {
            throw new MercadoPagoNoDisponibleException(
                    "El débito automático no está configurado: falta la credencial de Mercado Pago (variable MP_ACCESS_TOKEN)");
        }
        if (!sincronizando.tryAcquire()) {
            return new ResultadoSincronizacion(0, 0, 0, true);
        }
        try {
            List<Long> ids = transaccion.execute(estado -> debitoRepository.findByEstadoInOrderByFechaAltaDesc(VIGENTES)
                    .stream().map(DebitoAutomatico::getIdDebito).toList());
            int nuevos = 0;
            int errores = 0;
            for (Long id : ids == null ? List.<Long>of() : ids) {
                try {
                    nuevos += sincronizarUno(id);
                } catch (RuntimeException e) {
                    errores++;
                    log.warn("No se pudo sincronizar el débito automático {}: {}", id, e.getMessage());
                }
            }
            return new ResultadoSincronizacion(ids == null ? 0 : ids.size(), nuevos, errores, false);
        } finally {
            sincronizando.release();
        }
    }

    /** "Actualizar" de una sola adhesión (ficha del socio, después de autorizar en Mercado Pago). */
    public DebitoAutomaticoDTO sincronizar(Long idDebito) {
        sincronizarUno(idDebito);
        return transaccion.execute(estado -> debitoRepository.findById(idDebito).map(this::aDto)
                .orElseThrow(() -> new NoSuchElementException("No existe el débito automático " + idDebito)));
    }

    /**
     * Trae de Mercado Pago el estado de la suscripción y sus cobros. Cada cobro aprobado nuevo se registra como
     * pago (el id de Mercado Pago evita duplicados); un rechazo queda como alerta.
     *
     * @return cuántos cobros nuevos se registraron
     */
    private int sincronizarUno(Long idDebito) {
        if (!mercadoPago.habilitado()) {
            throw new MercadoPagoNoDisponibleException(
                    "El débito automático no está configurado: falta la credencial de Mercado Pago (variable MP_ACCESS_TOKEN)");
        }
        Integer nuevos = transaccion.execute(estado -> {
            DebitoAutomatico debito = debitoRepository.findById(idDebito)
                    .orElseThrow(() -> new NoSuchElementException("No existe el débito automático " + idDebito));
            if (debito.getMpPreapprovalId() == null) {
                return 0;
            }
            JsonNode suscripcion;
            try {
                suscripcion = mercadoPago.obtenerSuscripcion(debito.getMpPreapprovalId());
            } catch (NoSuchElementException e) {
                // Ya no existe en Mercado Pago: no puede seguir cobrando
                if (debito.getEstado() != EstadoDebito.CANCELADO) {
                    marcarBaja(debito, null);
                }
                return 0;
            }
            actualizarDesde(debito, suscripcion);

            int registrados = 0;
            for (JsonNode cobro : mercadoPago.cobrosDeSuscripcion(debito.getMpPreapprovalId())) {
                JsonNode pago = cobro.path("payment");
                String idPago = pago.path("id").asText("");
                String estadoPago = pago.path("status").asText("");
                LocalDateTime fecha = fecha(cobro.path("debit_date"));
                if (fecha == null) fecha = fecha(cobro.path("date_created"));
                if (fecha == null) fecha = LocalDateTime.now();

                if ("approved".equals(estadoPago) && !idPago.isBlank()) {
                    BigDecimal monto = cobro.hasNonNull("transaction_amount")
                            ? cobro.get("transaction_amount").decimalValue() : debito.getMonto();
                    if (pagoService.registrarCobroAutomatico(debito.getUsuario(), debito.getPlan(), monto, idPago, fecha)) {
                        registrados++;
                    }
                    if (debito.getUltimoCobro() == null || fecha.isAfter(debito.getUltimoCobro())) {
                        debito.setUltimoCobro(fecha);
                    }
                } else if ("rejected".equals(estadoPago)
                        && (debito.getUltimoRechazo() == null || fecha.isAfter(debito.getUltimoRechazo()))) {
                    debito.setUltimoRechazo(fecha);
                    debito.setDetalleRechazo(textoRechazo(pago.path("status_detail").asText("")));
                }
            }
            // Un cobro aprobado posterior al último rechazo apaga la alerta
            if (debito.getUltimoRechazo() != null && debito.getUltimoCobro() != null
                    && debito.getUltimoCobro().isAfter(debito.getUltimoRechazo())) {
                debito.setUltimoRechazo(null);
                debito.setDetalleRechazo(null);
            }
            debito.setUltimaSincronizacion(LocalDateTime.now());
            debitoRepository.save(debito);
            return registrados;
        });
        return nuevos == null ? 0 : nuevos;
    }

    private void actualizarDesde(DebitoAutomatico debito, JsonNode suscripcion) {
        switch (suscripcion.path("status").asText("")) {
            case "authorized" -> debito.setEstado(EstadoDebito.ACTIVO);
            case "paused" -> debito.setEstado(EstadoDebito.PAUSADO);
            case "cancelled" -> {
                if (debito.getEstado() != EstadoDebito.CANCELADO) {
                    marcarBaja(debito, null); // la canceló el socio desde la app de Mercado Pago
                }
            }
            default -> { } // "pending": sigue esperando que el socio la autorice
        }
        LocalDateTime proximo = fecha(suscripcion.path("next_payment_date"));
        debito.setProximoCobro(proximo != null && debito.getEstado() == EstadoDebito.ACTIVO ? proximo.toLocalDate() : null);
        String medio = suscripcion.path("payment_method_id").asText("");
        if (!medio.isBlank()) {
            debito.setMedioPago(medio);
        }
    }

    // ---------- Auxiliares ----------

    private DebitoAutomatico baja(DebitoAutomatico debito, String emailQuien) {
        if (debito.getEstado() == EstadoDebito.CANCELADO) {
            throw new IllegalStateException("Ese débito automático ya está dado de baja");
        }
        // Si Mercado Pago no confirma la baja, se corta acá con una excepción y NO se marca la baja (seguiría cobrando)
        cancelarEnMercadoPago(debito);
        marcarBaja(debito, emailQuien);
        return debitoRepository.save(debito);
    }

    private void cancelarEnMercadoPago(DebitoAutomatico debito) {
        if (debito.getMpPreapprovalId() == null) {
            return;
        }
        try {
            mercadoPago.cancelarSuscripcion(debito.getMpPreapprovalId());
        } catch (NoSuchElementException e) {
            log.info("La suscripción {} ya no existe en Mercado Pago", debito.getMpPreapprovalId());
        }
    }

    private void marcarBaja(DebitoAutomatico debito, String emailQuien) {
        debito.setEstado(EstadoDebito.CANCELADO);
        debito.setFechaBaja(LocalDateTime.now());
        debito.setBajaPor(usuarioPorEmail(emailQuien));
        debito.setProximoCobro(null);
    }

    // Mercado Pago cobra cada N meses: el plan tiene que durar 30 días o un múltiplo (60, 90...)
    private static int mesesDelPlan(Plan plan) {
        Integer dias = plan.getDuracionDias();
        if (dias == null || dias <= 0 || dias % 30 != 0 || dias / 30 > 12) {
            throw new IllegalArgumentException("El débito automático funciona con planes mensuales (30 días) o de "
                    + "varios meses exactos. El plan " + plan.getNombrePlan() + " dura " + dias + " días.");
        }
        return dias / 30;
    }

    // Fechas de Mercado Pago: "2026-10-11T10:30:00.000-04:00" → hora local del gimnasio
    private static LocalDateTime fecha(JsonNode nodo) {
        String texto = nodo == null ? "" : nodo.asText("");
        if (texto.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(texto).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    // Motivo del rechazo en palabras simples (Mercado Pago informa códigos como cc_rejected_insufficient_amount)
    private static String textoRechazo(String detalle) {
        if (detalle.contains("insufficient")) return "Fondos insuficientes";
        if (detalle.contains("disabled")) return "La tarjeta está deshabilitada";
        if (detalle.contains("bad_filled") || detalle.contains("expired")) return "Datos de la tarjeta vencidos o incorrectos";
        if (detalle.contains("call_for_authorize")) return "El banco pide autorizar el pago";
        if (detalle.contains("high_risk") || detalle.contains("blacklist")) return "Rechazado por seguridad";
        if (detalle.contains("max_attempts")) return "Demasiados intentos";
        return "Rechazado por el banco o la billetera";
    }

    private Usuario usuarioPorEmail(String email) {
        return email == null ? null : usuarioRepository.findByEmail(email).orElse(null);
    }

    private DebitoAutomaticoDTO aDto(DebitoAutomatico d) {
        return DebitoAutomaticoDTO.builder()
                .idDebito(d.getIdDebito())
                .idSocio(d.getUsuario().getIdUsuario())
                .nombreSocio(d.getUsuario().getNombreCompleto())
                .dniSocio(d.getUsuario().getDni())
                .idPlan(d.getPlan().getIdPlan())
                .plan(d.getPlan().getNombrePlan())
                .monto(d.getMonto())
                .estado(d.getEstado().name())
                .linkAutorizacion(d.getEstado() == EstadoDebito.PENDIENTE_AUTORIZACION ? d.getLinkAutorizacion() : null)
                .emailPagador(d.getEmailPagador())
                .medioPago(d.getMedioPago())
                .fechaAlta(d.getFechaAlta())
                .creadoPor(d.getCreadoPor() != null ? d.getCreadoPor().getNombreCompleto() : null)
                .proximoCobro(d.getProximoCobro())
                .ultimoCobro(d.getUltimoCobro())
                .ultimoRechazo(d.getUltimoRechazo())
                .detalleRechazo(d.getDetalleRechazo())
                .fechaBaja(d.getFechaBaja())
                .ultimaSincronizacion(d.getUltimaSincronizacion())
                .build();
    }
}
