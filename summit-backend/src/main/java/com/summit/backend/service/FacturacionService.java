package com.summit.backend.service;

import com.summit.backend.arca.ArcaException;
import com.summit.backend.arca.CertificadosArca;
import com.summit.backend.arca.ClienteWsaa;
import com.summit.backend.arca.ClienteWsfe;
import com.summit.backend.arca.ConfiguracionArca;
import com.summit.backend.dto.ComprobanteFiscalDTO;
import com.summit.backend.dto.EstadoFacturacionDTO;
import com.summit.backend.dto.FacturaResumenDTO;
import com.summit.backend.dto.PruebaConexionDTO;
import com.summit.backend.model.ComprobanteFiscal;
import com.summit.backend.model.DatosFiscales;
import com.summit.backend.model.EstadoComprobante;
import com.summit.backend.model.EstadoPago;
import com.summit.backend.model.PagoHistorial;
import com.summit.backend.model.TipoComprobante;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.ComprobanteFiscalRepository;
import com.summit.backend.repository.PagoHistorialRepository;
import com.summit.backend.repository.UsuarioRepository;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Factura electrónica de ARCA (FACTURACION.md). Cada cobro aprobado deja su factura PENDIENTE en la misma transacción
 * (ningún cobro queda sin facturar) y, apenas se confirma, una cola la manda a ARCA:
 * <ol>
 *   <li>Se arma con los datos fiscales del momento: Factura C si el dueño es monotributista, B si es responsable
 *       inscripto (con el IVA contenido), a consumidor final o con el DNI del socio.</li>
 *   <li>Se le pregunta a ARCA el último número y se reserva el siguiente (queda ENVIANDO).</li>
 *   <li>Se pide el CAE. Si se corta la conexión sin respuesta queda INCIERTO, y antes de usar otro número se le
 *       pregunta a ARCA si lo autorizó: así nunca se duplica ni se saltea un número.</li>
 * </ol>
 * Si ARCA no responde se reintenta cada vez más espaciado (1, 5, 15 y 60 minutos). Un rechazo no consume el número:
 * se corrige el motivo y se reintenta. Una factura autorizada se anula con una nota de crédito.
 * Un solo hilo emite a la vez (la fecha de un comprobante no puede ser anterior a la del anterior).
 */
@Service
@Slf4j
public class FacturacionService {

    private static final ZoneId ZONA = ZoneId.of("America/Argentina/Buenos_Aires");
    private static final BigDecimal DIVISOR_IVA = new BigDecimal("1.21");   // alícuota general del 21%
    private static final int CONSUMIDOR_FINAL = 5;      // condición frente al IVA del receptor
    private static final int SIN_IDENTIFICAR = 99;
    private static final int DNI = 96;
    private static final int[] ESPERAS_MINUTOS = {1, 5, 15, 60};
    private static final int NUMERO_O_FECHA_FUERA_DE_ORDEN = 10016;
    // Errores de ARCA que se arreglan solos: internos (500 a 502) o un permiso de acceso que hay que renovar (600)
    private static final Set<Integer> ERRORES_PASAJEROS = Set.of(500, 501, 502, 600);
    private static final Set<EstadoComprobante> EN_EL_AIRE = EnumSet.of(EstadoComprobante.ENVIANDO, EstadoComprobante.INCIERTO);
    private static final Set<EstadoComprobante> EN_COLA =
            EnumSet.of(EstadoComprobante.PENDIENTE, EstadoComprobante.ENVIANDO, EstadoComprobante.INCIERTO);
    private static final String URL_QR = "https://www.arca.gob.ar/fe/qr/?p=";
    private static final int MAXIMO_POR_PASADA = 500;
    private static final int DIAS_AVISO_CERTIFICADO = 30;

    private final ConfiguracionArca config;
    private final CertificadosArca certificados;
    private final ClienteWsaa wsaa;
    private final ClienteWsfe wsfe;
    private final ComprobanteFiscalRepository comprobantes;
    private final PagoHistorialRepository pagos;
    private final UsuarioRepository usuarios;
    private final DatosFiscalesService datosFiscales;
    private final TransactionTemplate tx;

    private final ReentrantLock emitiendo = new ReentrantLock();
    private final AtomicBoolean otraPasada = new AtomicBoolean();
    private final ExecutorService segundoPlano = Executors.newSingleThreadExecutor(tarea -> {
        Thread hilo = new Thread(tarea, "facturacion-arca");
        hilo.setDaemon(true);
        return hilo;
    });

    public FacturacionService(ConfiguracionArca config, CertificadosArca certificados, ClienteWsaa wsaa, ClienteWsfe wsfe,
                              ComprobanteFiscalRepository comprobantes, PagoHistorialRepository pagos,
                              UsuarioRepository usuarios, DatosFiscalesService datosFiscales,
                              PlatformTransactionManager transacciones) {
        this.config = config;
        this.certificados = certificados;
        this.wsaa = wsaa;
        this.wsfe = wsfe;
        this.comprobantes = comprobantes;
        this.pagos = pagos;
        this.usuarios = usuarios;
        this.datosFiscales = datosFiscales;
        this.tx = new TransactionTemplate(transacciones);
    }

    @PreDestroy
    void cerrar() {
        segundoPlano.shutdownNow();
    }

    public boolean habilitada() {
        return config.habilitada();
    }

    // ===== Alta de comprobantes =====

    /**
     * Deja la factura de un cobro en la cola. Se llama dentro de la transacción que deja el pago APROBADO: si esa
     * transacción se deshace, la factura también. Un cobro sin monto no se factura.
     */
    public void encolarFactura(PagoHistorial pago) {
        if (!config.habilitada() || pago.getEstadoPago() != EstadoPago.APROBADO
                || pago.getMontoAbonado() == null || pago.getMontoAbonado().signum() <= 0) {
            return;
        }
        comprobantes.save(nuevaFactura(pago, datosFiscales.obtener().isIdentificarSocio(), null));
        procesarAlConfirmar();
    }

    /**
     * Factura un cobro aprobado que no tiene una vigente: uno de antes de prender la facturación, o uno cuya factura
     * se anuló (por ejemplo, para hacerla de nuevo con el DNI del socio).
     */
    @Transactional
    public ComprobanteFiscalDTO facturar(Long idPago, boolean conDni, String email) {
        exigirHabilitada();
        PagoHistorial pago = pagos.findParaActualizar(idPago)
                .orElseThrow(() -> new NoSuchElementException("No existe el cobro " + idPago));
        if (pago.getEstadoPago() != EstadoPago.APROBADO) {
            throw new IllegalStateException("Solo se factura un cobro aprobado");
        }
        if (pago.getMontoAbonado().signum() <= 0) {
            throw new IllegalStateException("Un cobro sin monto no se factura");
        }
        ComprobanteFiscal vigente = facturaVigente(comprobantes.findByPagoIdPagoOrderByIdComprobanteAsc(idPago), null);
        if (vigente != null) {
            throw new IllegalStateException("Ese cobro ya tiene la " + describir(vigente));
        }
        ComprobanteFiscal factura = comprobantes.save(nuevaFactura(pago, conDni, usuario(email)));
        procesarAlConfirmar();
        return aDto(factura);
    }

    /** Anula una factura autorizada con una nota de crédito por el total (ARCA no deja borrarla). */
    @Transactional
    public ComprobanteFiscalDTO anular(Long idFactura, String motivo, String email) {
        exigirHabilitada();
        String limpio = motivo == null ? "" : motivo.trim();
        if (limpio.length() < 3) {
            throw new IllegalArgumentException("Escribí el motivo de la anulación (queda registrado)");
        }
        if (limpio.length() > 200) {
            throw new IllegalArgumentException("El motivo no puede superar los 200 caracteres");
        }
        ComprobanteFiscal factura = buscarParaActualizar(idFactura);
        if (factura.isNotaCredito()) {
            throw new IllegalStateException("Una nota de crédito no se anula");
        }
        if (factura.getEstado() != EstadoComprobante.AUTORIZADO) {
            throw new IllegalStateException("Solo se anula una factura autorizada (esta está " + estadoTexto(factura) + ")");
        }
        exigirAmbienteActual(factura);
        ComprobanteFiscal nota = notaVigente(factura, null);
        if (nota != null) {
            throw new IllegalStateException("Esa factura ya tiene la " + describir(nota));
        }
        ComprobanteFiscal nueva = comprobantes.save(ComprobanteFiscal.builder()
                .pago(factura.getPago())
                .asociado(factura)
                .ambiente(factura.getAmbiente())
                .estado(EstadoComprobante.PENDIENTE)
                .notaCredito(true)
                .identificarReceptor(factura.isIdentificarReceptor())
                .impTotal(factura.getImpTotal())
                .motivo(limpio)
                .solicitadoPor(usuario(email))
                .proximoIntento(ahora())
                .build());
        procesarAlConfirmar();
        return aDto(nueva);
    }

    /** Vuelve a mandar un comprobante rechazado (después de corregir el motivo, por ejemplo los datos fiscales). */
    @Transactional
    public ComprobanteFiscalDTO reintentar(Long id) {
        exigirHabilitada();
        ComprobanteFiscal c = buscarParaActualizar(id);
        if (c.getEstado() != EstadoComprobante.RECHAZADO) {
            throw new IllegalStateException("Solo se reintenta un comprobante rechazado (este está " + estadoTexto(c) + ")");
        }
        exigirAmbienteActual(c);
        if (c.isNotaCredito()) {
            ComprobanteFiscal otra = notaVigente(c.getAsociado(), c);
            if (otra != null) {
                throw new IllegalStateException("Esa factura ya tiene la " + describir(otra));
            }
        } else {
            ComprobanteFiscal otra = facturaVigente(comprobantes.findByPagoIdPagoOrderByIdComprobanteAsc(c.getPago().getIdPago()), c);
            if (otra != null) {
                throw new IllegalStateException("Ese cobro ya tiene la " + describir(otra));
            }
        }
        c.setEstado(EstadoComprobante.PENDIENTE);
        c.setIntentos(0);
        c.setProximoIntento(ahora());
        c.setUltimoError(null);
        c.setObservaciones(null);
        procesarAlConfirmar();
        return aDto(c);
    }

    /** Lo que espera un reintento vuelve a la cola ya (por ejemplo, después de completar los datos fiscales). */
    @Transactional
    public void procesarAhora() {
        exigirHabilitada();
        comprobantes.reprogramar(config.ambiente(), EnumSet.of(EstadoComprobante.PENDIENTE, EstadoComprobante.INCIERTO), ahora());
        procesarAlConfirmar();
    }

    private ComprobanteFiscal nuevaFactura(PagoHistorial pago, boolean identificar, Usuario quien) {
        return ComprobanteFiscal.builder()
                .pago(pago)
                .ambiente(config.ambiente())
                .estado(EstadoComprobante.PENDIENTE)
                .notaCredito(false)
                .identificarReceptor(identificar)
                .impTotal(pago.getMontoAbonado())
                .solicitadoPor(quien)
                .proximoIntento(ahora())
                .build();
    }

    // ===== Cola de emisión =====

    // Apenas se confirma la transacción (antes, el comprobante no existe para el hilo de la cola)
    private void procesarAlConfirmar() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    procesarEnSegundoPlano();
                }
            });
        } else {
            procesarEnSegundoPlano();
        }
    }

    private void procesarEnSegundoPlano() {
        if (!config.habilitada()) {
            return;
        }
        segundoPlano.execute(() -> {
            try {
                procesarPendientes();
            } catch (RuntimeException e) {
                log.error("Falló la cola de facturación", e);
            }
        });
    }

    /** Reintentos: lo que quedó esperando (ARCA caído, faltaban datos) se vuelve a probar cuando le toca. */
    @Scheduled(fixedDelayString = "${summit.arca.reintentos-ms:60000}", initialDelayString = "${summit.arca.reintentos-ms:60000}")
    public void reintentarPendientes() {
        procesarPendientes();
    }

    /** Procesa la cola hasta vaciarla o hasta que ARCA no responda. Si ya se está procesando, avisa que hay más. */
    public void procesarPendientes() {
        if (!config.habilitada()) {
            return;
        }
        if (!emitiendo.tryLock()) {
            otraPasada.set(true);
            return;
        }
        try {
            do {
                otraPasada.set(false);
                procesarCola();
            } while (otraPasada.get());
        } finally {
            emitiendo.unlock();
        }
    }

    private void procesarCola() {
        for (int i = 0; i < MAXIMO_POR_PASADA; i++) {
            // Primero lo que quedó en el aire: hasta saber si ARCA lo autorizó no se usa otro número
            Optional<ComprobanteFiscal> enElAire =
                    comprobantes.findFirstByAmbienteAndEstadoInOrderByIdComprobanteAsc(config.ambiente(), EN_EL_AIRE);
            boolean seguir;
            if (enElAire.isPresent()) {
                Optional<ComprobanteFiscal> listo = comprobantes
                        .findFirstByAmbienteAndEstadoInAndProximoIntentoLessThanEqualOrderByIdComprobanteAsc(
                                config.ambiente(), EN_EL_AIRE, ahora());
                if (listo.isEmpty()) {
                    return;
                }
                seguir = conciliar(listo.get().getIdComprobante());
            } else {
                Optional<ComprobanteFiscal> pendiente = comprobantes
                        .findFirstByAmbienteAndEstadoInAndProximoIntentoLessThanEqualOrderByIdComprobanteAsc(
                                config.ambiente(), EnumSet.of(EstadoComprobante.PENDIENTE), ahora());
                if (pendiente.isEmpty()) {
                    return;
                }
                seguir = emitir(pendiente.get().getIdComprobante());
            }
            if (!seguir) {
                return;
            }
        }
    }

    /** Lo necesario para pedir el CAE, armado con los datos fiscales del momento. */
    private record Preparado(String cuit, int puntoVenta, TipoComprobante tipo, int docTipo, long docNro,
                             BigDecimal total, BigDecimal neto, BigDecimal iva, LocalDate servicioDesde,
                             LocalDate servicioHasta, ClienteWsfe.Asociado asociado) {
    }

    // preparado null: no se puede mandar (seguir dice si se pasa al próximo de la cola)
    private record Preparacion(Preparado preparado, boolean seguir) {
    }

    // Devuelve si se puede seguir con el próximo de la cola
    private boolean emitir(Long id) {
        Preparacion preparacion = tx.execute(estado -> preparar(id));
        if (preparacion == null || preparacion.preparado() == null) {
            return preparacion != null && preparacion.seguir();
        }
        Preparado p = preparacion.preparado();
        long ultimo;
        try {
            ultimo = wsfe.ultimoAutorizado(p.cuit(), p.puntoVenta(), p.tipo().codigo());
        } catch (IOException | ArcaException e) {
            tx.executeWithoutResult(estado -> esperar(buscar(id), sinRespuesta(e)));
            return false;
        }
        ClienteWsfe.Solicitud solicitud;
        try {
            solicitud = tx.execute(estado -> numerar(id, p, ultimo + 1));
        } catch (RuntimeException e) {
            log.error("No se pudo reservar el número {} para el comprobante {}", ultimo + 1, id, e);
            tx.executeWithoutResult(estado -> esperar(buscar(id), "No se pudo reservar el número " + (ultimo + 1)
                    + ": " + mensaje(e)));
            return false;
        }
        ClienteWsfe.Respuesta respuesta;
        try {
            respuesta = wsfe.solicitarCae(solicitud);
        } catch (IOException | ArcaException | RuntimeException e) {
            // No se sabe si llegó: queda INCIERTO hasta preguntarle a ARCA
            tx.executeWithoutResult(estado -> enElAire(buscar(id), "Se cortó la comunicación con ARCA al pedir el CAE ("
                    + mensaje(e) + "): se le va a preguntar si lo autorizó"));
            return false;
        }
        return Boolean.TRUE.equals(tx.execute(estado -> registrar(id, respuesta)));
    }

    private Preparacion preparar(Long id) {
        ComprobanteFiscal c = buscar(id);
        c.setIntentos(c.getIntentos() + 1);
        DatosFiscales d = datosFiscales.obtener();
        List<String> faltan = DatosFiscalesService.faltantes(d);
        if (!faltan.isEmpty()) {
            esperar(c, "Faltan datos fiscales en Ajustes > Facturación: " + String.join(", ", faltan));
            return new Preparacion(null, false);
        }

        TipoComprobante tipo;
        int docTipo;
        long docNro;
        String nombre;
        LocalDate desde;
        LocalDate hasta;
        ClienteWsfe.Asociado asociado = null;
        if (c.isNotaCredito()) {
            ComprobanteFiscal factura = c.getAsociado();
            if (!d.getCuit().equals(factura.getCuitEmisor())) {
                rechazar(c, "La factura que anula es de otra CUIT (" + factura.getCuitEmisor() + ")");
                return new Preparacion(null, true);
            }
            tipo = factura.getTipo().notaCredito();
            docTipo = factura.getDocTipo();
            docNro = factura.getDocNro();
            nombre = factura.getReceptorNombre();
            desde = factura.getServicioDesde();
            hasta = factura.getServicioHasta();
            asociado = new ClienteWsfe.Asociado(factura.getTipo().codigo(), factura.getPuntoVenta(), factura.getNumero(),
                    factura.getCuitEmisor(), factura.getFecha());
        } else {
            tipo = TipoComprobante.factura(d.getCondicionIva());
            Usuario socio = c.getPago().getUsuario();
            String dni = socio.getDni() == null ? "" : socio.getDni().replaceAll("\\D", "");
            if (c.isIdentificarReceptor() && dni.matches("\\d{7,8}")) {
                docTipo = DNI;
                docNro = Long.parseLong(dni);
                nombre = socio.getNombreCompleto();
            } else {
                docTipo = SIN_IDENTIFICAR;
                docNro = 0;
                nombre = null;
            }
            // El período facturado es la membresía que se pagó
            PagoHistorial pago = c.getPago();
            LocalDate cobro = pago.getFechaPago().toLocalDate();
            hasta = pago.getVenceMembresia() != null ? pago.getVenceMembresia() : cobro;
            desde = pago.getVenceMembresia() != null ? hasta.minusDays(pago.getPlan().getDuracionDias()) : cobro;
            if (desde.isAfter(hasta)) {
                desde = hasta;
            }
        }
        BigDecimal total = c.getImpTotal().setScale(2, RoundingMode.HALF_EVEN);
        BigDecimal neto = tipo.llevaIva() ? total.divide(DIVISOR_IVA, 2, RoundingMode.HALF_EVEN) : total;
        BigDecimal iva = total.subtract(neto);

        c.setTipo(tipo);
        c.setPuntoVenta(d.getPuntoVenta());
        c.setCuitEmisor(d.getCuit());
        c.setEmisorRazonSocial(d.getRazonSocial());
        c.setEmisorDomicilio(d.getDomicilioComercial());
        c.setEmisorCondicionIva(d.getCondicionIva());
        c.setEmisorIngresosBrutos(d.getIngresosBrutos());
        c.setEmisorInicioActividades(d.getInicioActividades());
        c.setDocTipo(docTipo);
        c.setDocNro(docNro);
        c.setCondicionIvaReceptor(CONSUMIDOR_FINAL);
        c.setReceptorNombre(nombre);
        c.setImpNeto(neto);
        c.setImpIva(iva);
        c.setServicioDesde(desde);
        c.setServicioHasta(hasta);
        return new Preparacion(new Preparado(d.getCuit(), d.getPuntoVenta(), tipo, docTipo, docNro, total, neto, iva,
                desde, hasta, asociado), true);
    }

    // Reserva el número: desde acá, si se corta, el comprobante queda en el aire hasta preguntarle a ARCA
    private ClienteWsfe.Solicitud numerar(Long id, Preparado p, long numero) {
        ComprobanteFiscal c = buscar(id);
        LocalDate hoy = LocalDate.now(ZONA);
        LocalDate ultimaFecha = comprobantes.ultimaFecha(c.getAmbiente(), p.cuit(), p.tipo(), p.puntoVenta());
        LocalDate fecha = ultimaFecha != null && ultimaFecha.isAfter(hoy) ? ultimaFecha : hoy;
        c.setNumero(numero);
        c.setFecha(fecha);
        c.setVencimientoPago(fecha);
        c.setEstado(EstadoComprobante.ENVIANDO);
        c.setProximoIntento(ahora());
        c.setUltimoError(null);
        comprobantes.saveAndFlush(c);
        return new ClienteWsfe.Solicitud(p.cuit(), p.puntoVenta(), p.tipo().codigo(), numero, fecha, p.docTipo(),
                p.docNro(), CONSUMIDOR_FINAL, p.total(), p.neto(), p.iva(), p.servicioDesde(), p.servicioHasta(), fecha,
                p.asociado());
    }

    private boolean registrar(Long id, ClienteWsfe.Respuesta r) {
        ComprobanteFiscal c = buscar(id);
        c.setUltimoPedido(r.pedido());
        c.setUltimaRespuesta(r.respuesta());
        if (r.aprobado()) {
            c.setEstado(EstadoComprobante.AUTORIZADO);
            c.setCae(r.cae());
            c.setCaeVencimiento(r.caeVencimiento());
            c.setObservaciones(texto(r.observaciones()));
            c.setAutorizado(LocalDateTime.now());
            c.setProximoIntento(null);
            c.setUltimoError(null);
            return true;
        }
        // No se autorizó: el número no se consumió
        c.setNumero(null);
        c.setFecha(null);
        List<ClienteWsfe.Mensaje> todos = Stream.concat(r.errores().stream(), r.observaciones().stream()).toList();
        Set<Integer> codigos = todos.stream().map(ClienteWsfe.Mensaje::codigo).collect(Collectors.toSet());
        if (codigos.contains(NUMERO_O_FECHA_FUERA_DE_ORDEN)) {
            // Alguien usó ese número (por ejemplo, desde la web de ARCA): se pide el siguiente
            c.setEstado(EstadoComprobante.PENDIENTE);
            c.setUltimoError("ARCA dijo que el número o la fecha no eran los siguientes: se vuelve a intentar");
            c.setProximoIntento(c.getIntentos() <= 2 ? ahora() : ahora().plusMinutes(espera(c)));
            return true;
        }
        if (r.observaciones().isEmpty() && !r.errores().isEmpty() && ERRORES_PASAJEROS.containsAll(codigos)) {
            c.setEstado(EstadoComprobante.PENDIENTE);
            esperar(c, "ARCA no pudo procesarlo (" + texto(r.errores()) + ")");
            return false;
        }
        c.setObservaciones(texto(todos));
        rechazar(c, "ARCA lo rechazó: " + (todos.isEmpty() ? "sin motivo" : todos.get(0).texto()));
        return true;
    }

    /** Lo que quedó en el aire: si ARCA lo tiene, quedó autorizado; si no, vuelve a la cola con un número nuevo. */
    private boolean conciliar(Long id) {
        ComprobanteFiscal datos = tx.execute(estado -> {
            ComprobanteFiscal c = buscar(id);
            c.setIntentos(c.getIntentos() + 1);
            return c;
        });
        Optional<ClienteWsfe.Consultado> consultado;
        try {
            consultado = wsfe.consultar(datos.getCuitEmisor(), datos.getTipo().codigo(), datos.getPuntoVenta(), datos.getNumero());
        } catch (IOException | ArcaException e) {
            tx.executeWithoutResult(estado -> enElAire(buscar(id), "No se pudo confirmar con ARCA si lo autorizó ("
                    + mensaje(e) + ")"));
            return false;
        }
        tx.executeWithoutResult(estado -> {
            ComprobanteFiscal c = buscar(id);
            ClienteWsfe.Consultado r = consultado.orElse(null);
            if (r != null && r.aprobado() && r.total().compareTo(c.getImpTotal()) == 0
                    && r.docNro() == c.getDocNro() && c.getFecha().equals(r.fecha())) {
                c.setEstado(EstadoComprobante.AUTORIZADO);
                c.setCae(r.cae());
                c.setCaeVencimiento(r.caeVencimiento());
                c.setObservaciones("Se confirmó con ARCA después de un corte de conexión");
                c.setAutorizado(LocalDateTime.now());
                c.setProximoIntento(null);
                c.setUltimoError(null);
                return;
            }
            if (r != null) {
                log.warn("El número {} ({}) lo tiene otro comprobante en ARCA: el {} va con otro número",
                        c.numeroCompleto(), c.getTipo(), c.getIdComprobante());
            }
            c.setNumero(null);
            c.setFecha(null);
            c.setEstado(EstadoComprobante.PENDIENTE);
            c.setProximoIntento(ahora());
            c.setUltimoError(r == null ? null : "Ese número lo usó otro comprobante en ARCA: se pide uno nuevo");
        });
        return true;
    }

    private void esperar(ComprobanteFiscal c, String motivo) {
        c.setUltimoError(recortar(motivo));
        c.setProximoIntento(ahora().plusMinutes(espera(c)));
    }

    private void enElAire(ComprobanteFiscal c, String motivo) {
        c.setEstado(EstadoComprobante.INCIERTO);
        esperar(c, motivo);
    }

    private void rechazar(ComprobanteFiscal c, String motivo) {
        c.setEstado(EstadoComprobante.RECHAZADO);
        c.setNumero(null);
        c.setFecha(null);
        c.setUltimoError(recortar(motivo));
        c.setProximoIntento(null);
        log.warn("Comprobante {} rechazado: {}", c.getIdComprobante(), motivo);
    }

    private static int espera(ComprobanteFiscal c) {
        return ESPERAS_MINUTOS[Math.min(Math.max(c.getIntentos(), 1), ESPERAS_MINUTOS.length) - 1];
    }

    // ===== Consultas =====

    @Transactional(readOnly = true)
    public Page<ComprobanteFiscalDTO> listar(EstadoComprobante estado, Pageable pageable) {
        exigirHabilitada();
        Page<ComprobanteFiscal> pagina = estado == null ? comprobantes.findByAmbiente(config.ambiente(), pageable)
                : comprobantes.findByAmbienteAndEstado(config.ambiente(), estado, pageable);
        return pagina.map(this::aDto);
    }

    @Transactional(readOnly = true)
    public ComprobanteFiscalDTO detalle(Long id) {
        exigirHabilitada();
        return aDto(buscar(id));
    }

    /** Los comprobantes de un cobro: su factura y, si se anuló, la nota de crédito (y los rechazados). */
    @Transactional(readOnly = true)
    public List<ComprobanteFiscalDTO> dePago(Long idPago) {
        exigirHabilitada();
        return comprobantes.findByPagoIdPagoOrderByIdComprobanteAsc(idPago).stream().map(this::aDto).toList();
    }

    /** La factura de cada cobro, para la caja (vacío con la facturación apagada). */
    @Transactional(readOnly = true)
    public Map<Long, FacturaResumenDTO> resumenes(Collection<Long> idsPago) {
        Map<Long, FacturaResumenDTO> resumenes = new HashMap<>();
        if (!config.habilitada() || idsPago.isEmpty()) {
            return resumenes;
        }
        Map<Long, List<ComprobanteFiscal>> porPago = comprobantes.findByPagoIdPagoIn(idsPago).stream()
                .collect(Collectors.groupingBy(c -> c.getPago().getIdPago()));
        porPago.forEach((idPago, lista) -> lista.stream()
                .filter(c -> !c.isNotaCredito())
                .max(Comparator.comparing(ComprobanteFiscal::getIdComprobante))
                .ifPresent(f -> resumenes.put(idPago, new FacturaResumenDTO(f.getIdComprobante(), f.getEstado().name(),
                        f.getTipo() == null ? null : f.getTipo().letra(), f.numeroCompleto(), anulada(f, lista)))));
        return resumenes;
    }

    @Transactional(readOnly = true)
    public EstadoFacturacionDTO estado() {
        if (!config.habilitada()) {
            return EstadoFacturacionDTO.apagada();
        }
        List<String> advertencias = new ArrayList<>();
        DatosFiscales d = datosFiscales.obtener();
        boolean cargado = false;
        String error = null;
        String sujeto = null;
        String cuitCertificado = null;
        LocalDate vence = null;
        Long dias = null;
        boolean deMentira = false;
        try {
            CertificadosArca.CertificadoArca c = certificados.actual();
            cargado = true;
            sujeto = c.certificado().getSubjectX500Principal().getName();
            cuitCertificado = c.cuit();
            vence = LocalDate.ofInstant(c.vence(), ZONA);
            dias = ChronoUnit.DAYS.between(LocalDate.now(ZONA), vence);
            deMentira = c.deMentira();
            if (!deMentira && dias <= DIAS_AVISO_CERTIFICADO) {
                advertencias.add(dias < 0 ? "El certificado de ARCA venció: hay que pedir uno nuevo"
                        : "El certificado de ARCA vence en " + dias + " días: conviene renovarlo");
            }
            if (cuitCertificado != null && d.getCuit() != null && !cuitCertificado.equals(d.getCuit())) {
                advertencias.add("El certificado es de la CUIT " + DatosFiscalesService.cuitConGuiones(cuitCertificado)
                        + " y los datos fiscales dicen " + DatosFiscalesService.cuitConGuiones(d.getCuit()));
            }
        } catch (ArcaException e) {
            error = e.getMessage();
        }
        List<String> faltan = DatosFiscalesService.faltantes(d);
        String ultimoError = comprobantes.findFirstByAmbienteAndEstadoInOrderByIdComprobanteAsc(config.ambiente(), EN_COLA)
                .map(ComprobanteFiscal::getUltimoError).orElse(null);
        return new EstadoFacturacionDTO(true, config.ambiente().name(), config.ambiente().deVerdad(), cargado, error,
                sujeto, cuitCertificado, vence, dias, deMentira, faltan.isEmpty(), faltan,
                comprobantes.countByAmbienteAndEstado(config.ambiente(), EstadoComprobante.PENDIENTE),
                comprobantes.countByAmbienteAndEstado(config.ambiente(), EstadoComprobante.INCIERTO)
                        + comprobantes.countByAmbienteAndEstado(config.ambiente(), EstadoComprobante.ENVIANDO),
                comprobantes.countByAmbienteAndEstado(config.ambiente(), EstadoComprobante.RECHAZADO),
                ultimoError, advertencias);
    }

    /**
     * "Probar conexión": servidores de ARCA, certificado y permiso de acceso, datos fiscales, punto de venta y último
     * comprobante. Se corta en el primer paso que falla. Si todo anda, procesa lo que estaba esperando.
     */
    public PruebaConexionDTO probarConexion() {
        exigirHabilitada();
        List<PruebaConexionDTO.Paso> pasos = new ArrayList<>();
        String lugar = switch (config.ambiente()) {
            case SIMULADOR -> "el simulador (no es ARCA de verdad)";
            case HOMOLOGACION -> "ARCA, ambiente de pruebas (homologación)";
            case PRODUCCION -> "ARCA (producción)";
        };
        try {
            ClienteWsfe.Servidores s = wsfe.estadoServidores();
            pasos.add(new PruebaConexionDTO.Paso("Servidores de " + lugar, s.ok(), "Aplicación " + s.aplicacion()
                    + ", base de datos " + s.baseDeDatos() + ", autenticación " + s.autenticacion()));
            if (!s.ok()) {
                return new PruebaConexionDTO(false, pasos);
            }
        } catch (IOException | ArcaException e) {
            pasos.add(new PruebaConexionDTO.Paso("Servidores de " + lugar, false, sinRespuesta(e)));
            return new PruebaConexionDTO(false, pasos);
        }

        certificados.olvidar();   // por si se cambió el archivo
        try {
            CertificadosArca.CertificadoArca c = certificados.actual();
            wsaa.credenciales();
            pasos.add(new PruebaConexionDTO.Paso("Certificado y permiso de acceso", true, c.deMentira()
                    ? "Certificado de mentira del simulador"
                    : "Certificado de " + c.certificado().getSubjectX500Principal().getName() + ", vence el "
                    + TextoFechas.completa(LocalDate.ofInstant(c.vence(), ZONA))));
        } catch (IOException | ArcaException e) {
            pasos.add(new PruebaConexionDTO.Paso("Certificado y permiso de acceso", false, sinRespuesta(e)));
            return new PruebaConexionDTO(false, pasos);
        }

        DatosFiscales d = datosFiscales.obtener();
        List<String> faltan = DatosFiscalesService.faltantes(d);
        if (!faltan.isEmpty()) {
            pasos.add(new PruebaConexionDTO.Paso("Datos fiscales", false, "Faltan: " + String.join(", ", faltan)));
            return new PruebaConexionDTO(false, pasos);
        }
        pasos.add(new PruebaConexionDTO.Paso("Datos fiscales", true, d.getRazonSocial() + ", CUIT "
                + DatosFiscalesService.cuitConGuiones(d.getCuit()) + ", " + d.getCondicionIva().texto()));

        try {
            List<ClienteWsfe.PuntoVenta> puntos = wsfe.puntosDeVenta(d.getCuit());
            Optional<ClienteWsfe.PuntoVenta> punto = puntos.stream().filter(p -> p.numero() == d.getPuntoVenta()).findFirst();
            if (puntos.isEmpty() && !config.ambiente().deVerdad()) {
                pasos.add(new PruebaConexionDTO.Paso("Punto de venta", true, "En pruebas ARCA no tiene puntos de venta "
                        + "dados de alta: se usa el " + d.getPuntoVenta()));
            } else if (punto.isEmpty() || punto.get().bloqueado() || punto.get().baja() != null) {
                pasos.add(new PruebaConexionDTO.Paso("Punto de venta", false, "El punto de venta " + d.getPuntoVenta()
                        + (punto.isEmpty() ? " no está dado de alta para web services en ARCA"
                        : punto.get().bloqueado() ? " está bloqueado en ARCA" : " está dado de baja en ARCA")
                        + (puntos.isEmpty() ? "" : " (los de web services son: " + puntos.stream()
                        .map(p -> String.valueOf(p.numero())).collect(Collectors.joining(", ")) + ")")));
                return new PruebaConexionDTO(false, pasos);
            } else {
                pasos.add(new PruebaConexionDTO.Paso("Punto de venta", true, "El " + d.getPuntoVenta()
                        + " está habilitado para web services"));
            }
            TipoComprobante tipo = TipoComprobante.factura(d.getCondicionIva());
            long ultimo = wsfe.ultimoAutorizado(d.getCuit(), d.getPuntoVenta(), tipo.codigo());
            pasos.add(new PruebaConexionDTO.Paso("Numeración", true, ultimo == 0
                    ? "Todavía no hay ninguna " + tipo.nombre() + " " + tipo.letra() + " en el punto de venta " + d.getPuntoVenta()
                    : "La última " + tipo.nombre() + " " + tipo.letra() + " autorizada es la " + ultimo));
        } catch (IOException | ArcaException e) {
            pasos.add(new PruebaConexionDTO.Paso("Punto de venta y numeración", false, sinRespuesta(e)));
            return new PruebaConexionDTO(false, pasos);
        }
        tx.executeWithoutResult(estado -> comprobantes.reprogramar(config.ambiente(),
                EnumSet.of(EstadoComprobante.PENDIENTE, EstadoComprobante.INCIERTO), ahora()));
        procesarEnSegundoPlano();
        return new PruebaConexionDTO(true, pasos);
    }

    // ===== Ayudas =====

    // Factura del cobro que sigue valiendo (no rechazada ni anulada con una nota de crédito autorizada)
    private static ComprobanteFiscal facturaVigente(List<ComprobanteFiscal> delPago, ComprobanteFiscal excepto) {
        return delPago.stream()
                .filter(c -> !c.isNotaCredito() && !mismo(c, excepto) && c.getEstado() != EstadoComprobante.RECHAZADO)
                .filter(f -> !anulada(f, delPago))
                .findFirst().orElse(null);
    }

    private static boolean anulada(ComprobanteFiscal factura, List<ComprobanteFiscal> delPago) {
        return delPago.stream().anyMatch(n -> n.isNotaCredito() && mismo(n.getAsociado(), factura)
                && n.getEstado() == EstadoComprobante.AUTORIZADO);
    }

    // Nota de crédito de la factura que no fue rechazada
    private ComprobanteFiscal notaVigente(ComprobanteFiscal factura, ComprobanteFiscal excepto) {
        return comprobantes.findByAsociado(factura).stream()
                .filter(n -> !mismo(n, excepto) && n.getEstado() != EstadoComprobante.RECHAZADO)
                .findFirst().orElse(null);
    }

    // Por id: una relación perezosa puede ser un proxy y no la misma instancia
    private static boolean mismo(ComprobanteFiscal a, ComprobanteFiscal b) {
        return a != null && b != null && a.getIdComprobante().equals(b.getIdComprobante());
    }

    private ComprobanteFiscalDTO aDto(ComprobanteFiscal c) {
        PagoHistorial pago = c.getPago();
        Usuario socio = pago.getUsuario();
        TipoComprobante tipo = c.getTipo();
        ComprobanteFiscal nota = c.isNotaCredito() ? null : notaVigente(c, null);
        return ComprobanteFiscalDTO.builder()
                .idComprobante(c.getIdComprobante())
                .idPago(pago.getIdPago())
                .idSocio(socio.getIdUsuario())
                .nombreSocio(socio.getNombreCompleto())
                .telefonoSocio(socio.getTelefono())
                .tipo(tipo == null ? null : tipo.name())
                .letra(tipo == null ? null : tipo.letra())
                .codigoTipo(tipo == null ? null : tipo.codigo())
                .nombreTipo(c.isNotaCredito() ? "Nota de crédito" : "Factura")
                .notaCredito(c.isNotaCredito())
                .puntoVenta(c.getPuntoVenta())
                .numero(c.getNumero())
                .numeroCompleto(c.numeroCompleto())
                .fecha(c.getFecha())
                .estado(c.getEstado().name())
                .ambiente(c.getAmbiente().name())
                .deVerdad(c.getAmbiente().deVerdad())
                .total(c.getImpTotal())
                .neto(c.getImpNeto())
                .iva(c.getImpIva())
                .cae(c.getCae())
                .caeVencimiento(c.getCaeVencimiento())
                .qrUrl(qr(c))
                .observaciones(c.getObservaciones())
                .ultimoError(c.getUltimoError())
                .intentos(c.getIntentos())
                .proximoIntento(c.getProximoIntento())
                .creado(c.getCreado())
                .autorizado(c.getAutorizado())
                .solicitadoPor(c.getSolicitadoPor() == null ? null : c.getSolicitadoPor().getNombreCompleto())
                .motivo(c.getMotivo())
                .idAsociado(c.getAsociado() == null ? null : c.getAsociado().getIdComprobante())
                .asociado(c.getAsociado() == null ? null : describir(c.getAsociado()))
                .idNotaCredito(nota == null ? null : nota.getIdComprobante())
                .descripcionNotaCredito(nota == null ? null : describir(nota))
                .estadoNotaCredito(nota == null ? null : nota.getEstado().name())
                .anulada(nota != null && nota.getEstado() == EstadoComprobante.AUTORIZADO)
                .emisorCuit(c.getCuitEmisor())
                .emisorRazonSocial(c.getEmisorRazonSocial())
                .emisorDomicilio(c.getEmisorDomicilio())
                .emisorCondicionIva(c.getEmisorCondicionIva() == null ? null : c.getEmisorCondicionIva().texto())
                .emisorIngresosBrutos(c.getEmisorIngresosBrutos())
                .emisorInicioActividades(c.getEmisorInicioActividades())
                .docTipo(c.getDocTipo())
                .docNro(c.getDocNro())
                .receptorNombre(c.getReceptorNombre())
                .servicioDesde(c.getServicioDesde())
                .servicioHasta(c.getServicioHasta())
                .vencimientoPago(c.getVencimientoPago())
                .fechaPago(pago.getFechaPago())
                .metodoPago(pago.getMetodoPago().name())
                .plan(pago.getPlan().getNombrePlan())
                .precioLista(pago.getPrecioLista())
                .descuentoNombre(pago.getDescuentoNombre())
                .descuentoMonto(pago.getDescuentoMonto())
                .matriculaMonto(pago.getMatriculaMonto())
                .build();
    }

    // Lo que codifica el QR de la factura (RG 4892): la dirección de ARCA con los datos del comprobante en Base64
    private static String qr(ComprobanteFiscal c) {
        if (c.getEstado() != EstadoComprobante.AUTORIZADO || c.getCae() == null) {
            return null;
        }
        String json = "{\"ver\":1,\"fecha\":\"" + c.getFecha() + "\",\"cuit\":" + c.getCuitEmisor()
                + ",\"ptoVta\":" + c.getPuntoVenta() + ",\"tipoCmp\":" + c.getTipo().codigo() + ",\"nroCmp\":" + c.getNumero()
                + ",\"importe\":" + c.getImpTotal().setScale(2, RoundingMode.HALF_EVEN).toPlainString()
                + ",\"moneda\":\"PES\",\"ctz\":1,\"tipoDocRec\":" + c.getDocTipo() + ",\"nroDocRec\":" + c.getDocNro()
                + ",\"tipoCodAut\":\"E\",\"codAut\":" + c.getCae() + "}";
        return URL_QR + Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }

    private static String describir(ComprobanteFiscal c) {
        String nombre = c.isNotaCredito() ? "nota de crédito" : "factura";
        if (c.getTipo() == null || c.getNumero() == null) {
            return nombre + " " + (c.getEstado() == EstadoComprobante.RECHAZADO ? "rechazada" : "pendiente");
        }
        return nombre + " " + c.getTipo().letra() + " " + c.numeroCompleto();
    }

    private static String estadoTexto(ComprobanteFiscal c) {
        return switch (c.getEstado()) {
            case PENDIENTE -> "pendiente";
            case ENVIANDO -> "enviándose";
            case INCIERTO -> "esperando confirmación de ARCA";
            case AUTORIZADO -> "autorizada";
            case RECHAZADO -> "rechazada";
        };
    }

    private static String texto(List<ClienteWsfe.Mensaje> mensajes) {
        return mensajes.isEmpty() ? null : mensajes.stream().map(ClienteWsfe.Mensaje::toString).collect(Collectors.joining("\n"));
    }

    private static String sinRespuesta(Exception e) {
        return e instanceof IOException ? "ARCA no responde: " + e.getMessage() : e.getMessage();
    }

    private static String mensaje(Exception e) {
        return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
    }

    private static String recortar(String texto) {
        return texto == null || texto.length() <= 500 ? texto : texto.substring(0, 497) + "...";
    }

    private void exigirHabilitada() {
        if (!config.habilitada()) {
            throw new IllegalStateException("La factura electrónica está apagada (summit.arca.habilitada)");
        }
    }

    private void exigirAmbienteActual(ComprobanteFiscal c) {
        if (c.getAmbiente() != config.ambiente()) {
            throw new IllegalStateException("Ese comprobante es del ambiente " + c.getAmbiente()
                    + " y ahora se factura en " + config.ambiente());
        }
    }

    private ComprobanteFiscal buscar(Long id) {
        return comprobantes.findById(id).orElseThrow(() -> new NoSuchElementException("No existe el comprobante " + id));
    }

    private ComprobanteFiscal buscarParaActualizar(Long id) {
        return comprobantes.findParaActualizar(id).orElseThrow(() -> new NoSuchElementException("No existe el comprobante " + id));
    }

    private Usuario usuario(String email) {
        return email == null ? null : usuarios.findByEmail(email).orElse(null);
    }

    private static LocalDateTime ahora() {
        return LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }
}
