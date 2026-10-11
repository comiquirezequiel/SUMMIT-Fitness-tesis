package com.summit.backend.service;

import com.summit.backend.dto.CheckInRequest;
import com.summit.backend.dto.CheckInResponse;
import com.summit.backend.model.*;
import com.summit.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Servicio de asistencia y check-in.
 * Las reglas de ingreso se evalúan en un solo lugar (evaluarAcceso), sin escribir en la base:
 * 1. Estado de la cuenta
 * 2. Cuota al día (con días de gracia)
 * 3. Límite semanal del plan (ej. 3 veces por semana)
 * 4. Certificado médico vigente (Ley 5397, con días de gracia)
 * Recepción arma con esa evaluación la ficha del monitor y registra el intento; el portal del socio
 * la usa para mostrarle si puede entrar, sin registrar nada.
 * El check-in desde la app además aplica cooldown anti-spam y geolocalización (< 20 metros).
 */
@Service
@RequiredArgsConstructor
public class AsistenciaService {

    private final UsuarioRepository usuarioRepository;
    private final SuscripcionRepository suscripcionRepository;
    private final CertificadoMedicoRepository certificadoMedicoRepository;
    private final LogAsistenciaRepository logAsistenciaRepository;
    private final GeolocationService geolocationService;
    private final ConfiguracionAccesoService configService;

    // Mapa de cooldown: idUsuario -> último intento
    private final ConcurrentHashMap<Long, LocalDateTime> cooldownMap = new ConcurrentHashMap<>();

    private static final int COOLDOWN_SEGUNDOS = 30;

    // Con cuántos días de anticipación se avisa que algo está por vencer
    private static final int DIAS_AVISO_CUOTA = 7;
    private static final int DIAS_AVISO_APTO = 15;

    // Formatos de los textos (también los usa el portal del socio)
    static final DateTimeFormatter FECHA_CORTA = DateTimeFormatter.ofPattern("dd/MM");
    private static final String[] DIAS_SEMANA = {"lun", "mar", "mié", "jue", "vie", "sáb", "dom"};

    /**
     * Situación de la cuota o del apto médico frente a las reglas de ingreso.
     */
    public enum Vigencia {
        NO_EXIGIDA,  // el gimnasio no la exige para entrar
        FALTA,       // no tiene membresía activa / certificado cargado
        RECHAZADA,   // solo apto: el último certificado fue rechazado
        VENCIDA,     // venció y ya pasaron los días de gracia
        EN_GRACIA,   // venció, pero todavía está dentro de los días de gracia
        VENCE_HOY,
        POR_VENCER,  // vence dentro de los días de aviso
        AL_DIA;

        public boolean bloquea() {
            return this == FALTA || this == RECHAZADA || this == VENCIDA;
        }
    }

    /**
     * Resultado de evaluar las reglas de ingreso de un usuario en una fecha. No registra nada.
     * Para el personal solo se evalúa la cuenta: cuota y apto quedan en null.
     */
    public record EvaluacionAcceso(
            Usuario usuario,
            LocalDate fecha,
            ConfiguracionAcceso config,
            Suscripcion suscripcion,              // membresía activa (null si no tiene)
            CertificadoMedico certificado,        // el de vencimiento más lejano (null si no tiene)
            Vigencia cuota,
            Vigencia apto,
            SortedSet<LocalDate> diasConIngreso,  // días de esta semana (lunes a hoy) con un ingreso permitido
            boolean limiteSemanalExcedido,
            List<ResultadoAsistencia> motivos) {  // faltas en orden: cuenta → cuota → límite semanal → apto

        public boolean permitido() {
            return motivos.isEmpty();
        }

        // Si hay varias faltas, el resultado registrado es la primera
        public ResultadoAsistencia resultado() {
            return permitido() ? ResultadoAsistencia.PERMITIDO : motivos.get(0);
        }

        public boolean esPersonal() {
            return usuario.getRol() != Rol.SOCIO;
        }

        // Días por semana del plan: null = pase libre (o sin membresía)
        public Integer diasSemanaPermitidos() {
            return suscripcion != null ? suscripcion.getPlan().getVecesPorSemana() : null;
        }

        public boolean yaIngresoHoy() {
            return diasConIngreso.contains(fecha);
        }

        // Los "días para vencer" son negativos si ya venció
        public Long diasParaVencerCuota() {
            return suscripcion != null ? ChronoUnit.DAYS.between(fecha, suscripcion.getFechaVencimiento()) : null;
        }

        public Long diasParaVencerApto() {
            return certificado != null ? ChronoUnit.DAYS.between(fecha, certificado.getFechaVencimiento()) : null;
        }

        // Días de gracia que quedan después de hoy (0 = hoy es el último). Solo tiene sentido EN_GRACIA
        public long graciaRestanteCuota() {
            return config.getDiasGraciaMembresia() + diasParaVencerCuota();
        }

        public long graciaRestanteApto() {
            return config.getDiasGraciaCertificado() + diasParaVencerApto();
        }
    }

    /**
     * Procesa un intento de check-in con validación completa.
     */
    public CheckInResponse procesarCheckIn(CheckInRequest request) {
        // 1. Identificar al socio (por DNI directo o por código QR que contiene el DNI)
        String dniSocio = request.getCodigoQr() != null ? request.getCodigoQr() : request.getDni();
        if (dniSocio == null || dniSocio.isEmpty()) {
            throw new RuntimeException("Debe proporcionar un DNI o código QR");
        }

        Usuario socio = usuarioRepository.findByDni(dniSocio)
                .orElseThrow(() -> new RuntimeException("No se encontró un socio con DNI: " + dniSocio));

        // 2. Verificar cooldown anti-spam
        LocalDateTime ultimoIntento = cooldownMap.get(socio.getIdUsuario());
        if (ultimoIntento != null) {
            long segundosDesdeUltimo = java.time.Duration.between(ultimoIntento, LocalDateTime.now()).getSeconds();
            if (segundosDesdeUltimo < COOLDOWN_SEGUNDOS) {
                throw new RuntimeException(
                        "Debe esperar " + (COOLDOWN_SEGUNDOS - segundosDesdeUltimo) +
                        " segundos antes del próximo intento de check-in");
            }
        }

        // Determinar tipo de evento
        TipoEventoAsistencia tipoEvento = TipoEventoAsistencia.CHECKIN_MANUAL;
        if (request.getTipoEvento() != null) {
            try {
                tipoEvento = TipoEventoAsistencia.valueOf(request.getTipoEvento());
            } catch (IllegalArgumentException ignored) {
                // Mantener CHECKIN_MANUAL por defecto
            }
        }

        // 3. Verificar geolocalización (Haversine)
        double distancia = geolocationService.getDistanciaAlGimnasio(request.getLatitud(), request.getLongitud());

        if (!geolocationService.estaDentroDelGimnasio(request.getLatitud(), request.getLongitud())) {
            registrarLog(socio, tipoEvento, ResultadoAsistencia.DENEGADO_FUERA_DE_RANGO_GPS,
                    request.getLatitud(), request.getLongitud(), distancia);
            cooldownMap.put(socio.getIdUsuario(), LocalDateTime.now());

            String motivo = String.format("Fuera de rango GPS. Distancia: %.1f metros (máx. 20m)", distancia);
            CheckInResponse respuesta = fichaBase(socio, distancia);
            respuesta.setPermitido(false);
            respuesta.setResultado(ResultadoAsistencia.DENEGADO_FUERA_DE_RANGO_GPS.name());
            respuesta.setMensaje(motivo);
            respuesta.getFaltas().add(motivo);
            return respuesta;
        }

        return validarAccesoInterno(socio, tipoEvento, distancia);
    }

    /**
     * RF-06: Ingreso por recepción (sin GPS). El resultado es la notificación del monitor del recepcionista.
     */
    public CheckInResponse verificarAccesoMolinete(String dni) {
        if (dni == null || dni.isBlank()) {
            throw new RuntimeException("Debe proporcionar un DNI");
        }
        String dniLimpio = dni.trim();

        Usuario usuario = usuarioRepository.findByDni(dniLimpio)
                .orElseThrow(() -> new RuntimeException("No se encontró ningún socio con DNI " + dniLimpio));

        return validarAccesoInterno(usuario, TipoEventoAsistencia.INGRESO_MOLINETE, null);
    }

    /**
     * Evalúa todas las reglas de ingreso de hoy sin registrar nada (no se detiene en la primera falta).
     * La usan la verificación de recepción y el portal del socio: así los dos aplican las mismas reglas.
     */
    @Transactional(readOnly = true)
    public EvaluacionAcceso evaluarAcceso(Usuario usuario) {
        LocalDate hoy = LocalDate.now();
        List<ResultadoAsistencia> motivos = new ArrayList<>();

        if (usuario.getEstado() != EstadoUsuario.ACTIVO) {
            motivos.add(ResultadoAsistencia.DENEGADO_CUENTA_INACTIVA);
        }
        if (usuario.getRol() != Rol.SOCIO) {
            // Personal del gimnasio: su ingreso es presentismo, sin controles de socio
            return new EvaluacionAcceso(usuario, hoy, null, null, null, null, null,
                    Collections.emptySortedSet(), false, List.copyOf(motivos));
        }

        ConfiguracionAcceso config = configService.obtenerConfiguracionGlobal();
        Suscripcion suscripcion = suscripcionRepository
                .findFirstByUsuarioIdUsuarioAndActivaTrueOrderByFechaVencimientoDesc(usuario.getIdUsuario())
                .orElse(null);
        CertificadoMedico certificado = certificadoMedicoRepository
                .certificadoQueRige(usuario.getIdUsuario())
                .orElse(null);
        SortedSet<LocalDate> diasConIngreso = diasConIngresoEnLaSemana(usuario.getIdUsuario(), hoy);

        Vigencia cuota = vigenciaCuota(suscripcion, config, hoy);
        if (cuota.bloquea()) {
            motivos.add(ResultadoAsistencia.DENEGADO_CUOTA_VENCIDA);
        }

        // Volver a entrar el mismo día no descuenta otro día
        Integer permitidos = suscripcion != null ? suscripcion.getPlan().getVecesPorSemana() : null;
        boolean limiteExcedido = permitidos != null && config.isRequerirMembresiaActiva()
                && !diasConIngreso.contains(hoy) && diasConIngreso.size() >= permitidos;
        if (limiteExcedido) {
            motivos.add(ResultadoAsistencia.DENEGADO_LIMITE_SEMANAL);
        }

        Vigencia apto = vigenciaApto(certificado, config, hoy);
        if (apto.bloquea()) {
            motivos.add(ResultadoAsistencia.DENEGADO_CERTIFICADO_MEDICO);
        }

        return new EvaluacionAcceso(usuario, hoy, config, suscripcion, certificado, cuota, apto,
                diasConIngreso, limiteExcedido, List.copyOf(motivos));
    }

    /**
     * Evalúa las reglas, arma la ficha del monitor de recepción y registra el intento en el log.
     */
    private CheckInResponse validarAccesoInterno(Usuario usuario, TipoEventoAsistencia tipoEvento, Double distancia) {
        EvaluacionAcceso evaluacion = evaluarAcceso(usuario);
        CheckInResponse respuesta = fichaRecepcion(evaluacion, distancia);
        registrarLog(usuario, tipoEvento, evaluacion.resultado(), null, null, distancia);
        return respuesta;
    }

    private static Vigencia vigenciaCuota(Suscripcion suscripcion, ConfiguracionAcceso config, LocalDate hoy) {
        if (!config.isRequerirMembresiaActiva()) {
            return Vigencia.NO_EXIGIDA;
        }
        if (suscripcion == null) {
            return Vigencia.FALTA;
        }
        return vigenciaPorFecha(hoy, suscripcion.getFechaVencimiento(), config.getDiasGraciaMembresia(), DIAS_AVISO_CUOTA);
    }

    private static Vigencia vigenciaApto(CertificadoMedico certificado, ConfiguracionAcceso config, LocalDate hoy) {
        if (!config.isRequerirCertificadoMedico()) {
            return Vigencia.NO_EXIGIDA;
        }
        if (certificado == null) {
            return Vigencia.FALTA;
        }
        if (certificado.getEstadoLegal() == EstadoLegalCertificado.RECHAZADO) {
            return Vigencia.RECHAZADA;
        }
        return vigenciaPorFecha(hoy, certificado.getFechaVencimiento(), config.getDiasGraciaCertificado(), DIAS_AVISO_APTO);
    }

    // Lo vencido bloquea recién cuando pasan los días de gracia
    private static Vigencia vigenciaPorFecha(LocalDate hoy, LocalDate vencimiento, int diasGracia, int diasAviso) {
        long dias = ChronoUnit.DAYS.between(hoy, vencimiento);
        if (dias < 0) {
            return diasGracia + dias < 0 ? Vigencia.VENCIDA : Vigencia.EN_GRACIA;
        }
        if (dias == 0) {
            return Vigencia.VENCE_HOY;
        }
        return dias <= diasAviso ? Vigencia.POR_VENCER : Vigencia.AL_DIA;
    }

    /**
     * Días distintos de esta semana (lunes a hoy) con un ingreso permitido.
     */
    private SortedSet<LocalDate> diasConIngresoEnLaSemana(Long idUsuario, LocalDate hoy) {
        LocalDate lunes = hoy.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        TreeSet<LocalDate> dias = logAsistenciaRepository
                .findByUsuarioIdUsuarioAndResultadoAndFechaHoraBetween(idUsuario,
                        ResultadoAsistencia.PERMITIDO, lunes.atStartOfDay(), hoy.atTime(LocalTime.MAX))
                .stream()
                .map(log -> log.getFechaHora().toLocalDate())
                .collect(Collectors.toCollection(TreeSet::new));
        return Collections.unmodifiableSortedSet(dias);
    }

    /**
     * Ficha del monitor de recepción: los textos le hablan al recepcionista.
     * Las faltas siguen el orden de las reglas: cuenta → cuota → límite semanal → apto médico.
     */
    private CheckInResponse fichaRecepcion(EvaluacionAcceso ev, Double distancia) {
        Usuario usuario = ev.usuario();
        CheckInResponse respuesta = fichaBase(usuario, distancia);

        if (usuario.getEstado() != EstadoUsuario.ACTIVO) {
            respuesta.getFaltas().add("Cuenta " + textoEstado(usuario.getEstado()) + ": no puede ingresar");
        }
        if (ev.esPersonal()) {
            // Personal del gimnasio: el ingreso queda registrado como presentismo
            if (ev.permitido()) {
                respuesta.getAvisos().add("Personal del gimnasio (" + usuario.getRol().name() + "): se registra su ingreso");
            }
        } else {
            fichaCuota(ev, respuesta);
            if (ev.limiteSemanalExcedido()) {
                respuesta.getFaltas().add("Excedió los días semanales de su plan: ya usó "
                        + ev.diasConIngreso().size() + " de " + ev.diasSemanaPermitidos()
                        + " (" + detalleDias(ev.diasConIngreso()) + ")");
            }
            fichaApto(ev, respuesta);
            fichaSemana(ev, respuesta);
        }

        respuesta.setPermitido(ev.permitido());
        respuesta.setExcepcionPosible(admiteExcepcion(ev));
        respuesta.setResultado(ev.resultado().name());
        respuesta.setMensaje(ev.permitido() ? "Acceso permitido" : String.join(" · ", respuesta.getFaltas()));
        return respuesta;
    }

    private static void fichaCuota(EvaluacionAcceso ev, CheckInResponse respuesta) {
        Suscripcion suscripcion = ev.suscripcion();
        Long dias = ev.diasParaVencerCuota();
        String vence = null;
        if (suscripcion != null) {
            respuesta.setPlan(suscripcion.getPlan().getNombrePlan());
            respuesta.setVencimientoCuota(suscripcion.getFechaVencimiento());
            respuesta.setDiasParaVencerCuota(dias);
            vence = suscripcion.getFechaVencimiento().format(FECHA_CORTA);
        }
        switch (ev.cuota()) {
            case FALTA -> respuesta.getFaltas().add("No tiene una membresía activa");
            case VENCIDA -> respuesta.getFaltas().add("Cuota vencida el " + vence + " (hace " + textoDias(-dias) + ")");
            case EN_GRACIA -> respuesta.getAvisos().add("Cuota vencida el " + vence + ": ingresa por días de gracia ("
                    + textoGracia(ev.graciaRestanteCuota()) + ")");
            case VENCE_HOY -> respuesta.getAvisos().add("La cuota vence hoy");
            case POR_VENCER -> respuesta.getAvisos().add("La cuota vence en " + textoDias(dias) + " (" + vence + ")");
            default -> { } // al día o no exigida: nada que avisar
        }
    }

    private static void fichaApto(EvaluacionAcceso ev, CheckInResponse respuesta) {
        CertificadoMedico certificado = ev.certificado();
        Long dias = ev.diasParaVencerApto();
        String vence = null;
        if (certificado != null) {
            respuesta.setVencimientoApto(certificado.getFechaVencimiento());
            respuesta.setDiasParaVencerApto(dias);
            vence = certificado.getFechaVencimiento().format(FECHA_CORTA);
        }
        switch (ev.apto()) {
            case FALTA -> respuesta.getFaltas().add("No tiene certificado médico (apto físico) cargado");
            case RECHAZADA -> respuesta.getFaltas().add("Su último certificado médico fue rechazado");
            case VENCIDA -> respuesta.getFaltas().add("Apto médico vencido el " + vence + " (hace " + textoDias(-dias) + ")");
            case EN_GRACIA -> respuesta.getAvisos().add("Apto médico vencido el " + vence + ": ingresa por días de gracia ("
                    + textoGracia(ev.graciaRestanteApto()) + ")");
            case VENCE_HOY -> respuesta.getAvisos().add("El apto médico vence hoy");
            case POR_VENCER -> respuesta.getAvisos().add("El apto médico vence en " + textoDias(dias) + " (" + vence + ")");
            default -> { } // vigente o no exigido: nada que avisar
        }
    }

    /**
     * Días de la semana en la ficha: si el ingreso se permite, el de hoy ya cuenta como usado.
     */
    private static void fichaSemana(EvaluacionAcceso ev, CheckInResponse respuesta) {
        if (ev.suscripcion() == null) {
            return;
        }
        boolean cuentaHoy = ev.permitido() && !ev.yaIngresoHoy();
        int usados = ev.diasConIngreso().size() + (cuentaHoy ? 1 : 0);
        Integer permitidos = ev.diasSemanaPermitidos();
        respuesta.setDiasSemanaPermitidos(permitidos);
        respuesta.setDiasSemanaUsados(usados);
        if (permitidos != null) {
            int restantes = Math.max(0, permitidos - usados);
            respuesta.setDiasSemanaRestantes(restantes);
            if (cuentaHoy && restantes == 0) {
                respuesta.getAvisos().add("Hoy usa su último día disponible de la semana");
            }
        }
        if (ev.permitido() && ev.yaIngresoHoy()) {
            respuesta.getAvisos().add("Ya había ingresado hoy: no descuenta otro día");
        }
    }

    /**
     * Ingreso por excepción: recepción deja pasar a un socio con la cuota vencida o sin días de su plan esta semana
     * (ej. "pagó por transferencia y todavía no se acreditó"). Queda registrado quién lo autorizó y por qué.
     *
     * <p>Nunca se puede con el apto médico vencido o faltante (es una exigencia legal) ni con la cuenta inactiva,
     * suspendida o dada de baja. El registro queda como PERMITIDO: cuenta como visita y como día usado de la
     * semana, igual que cualquier ingreso.</p>
     */
    @Transactional
    public CheckInResponse registrarIngresoExcepcion(String dni, String motivo, String emailAutorizante) {
        if (dni == null || dni.isBlank()) {
            throw new IllegalArgumentException("Debe proporcionar un DNI");
        }
        String motivoLimpio = motivo == null ? "" : motivo.trim();
        if (motivoLimpio.length() < 5) {
            throw new IllegalArgumentException("Escribí el motivo de la excepción (queda registrado)");
        }
        if (motivoLimpio.length() > 200) {
            throw new IllegalArgumentException("El motivo no puede superar los 200 caracteres");
        }
        Usuario socio = usuarioRepository.findByDni(dni.trim())
                .orElseThrow(() -> new RuntimeException("No se encontró ningún socio con DNI " + dni.trim()));

        EvaluacionAcceso evaluacion = evaluarAcceso(socio);
        if (evaluacion.permitido()) {
            throw new IllegalStateException("El socio puede ingresar normalmente: no hace falta una excepción");
        }
        if (!admiteExcepcion(evaluacion)) {
            String motivoRechazo;
            if (evaluacion.motivos().contains(ResultadoAsistencia.DENEGADO_CERTIFICADO_MEDICO)) {
                motivoRechazo = "No se puede hacer una excepción sin apto médico vigente: es una exigencia legal";
            } else if (evaluacion.esPersonal() || evaluacion.motivos().contains(ResultadoAsistencia.DENEGADO_CUENTA_INACTIVA)) {
                motivoRechazo = "No se puede hacer una excepción: la cuenta del socio no está activa";
            } else {
                motivoRechazo = "El gimnasio no permite ingresos por excepción: se habilitan en Ajustes > Reglas de acceso";
            }
            throw new IllegalStateException(motivoRechazo);
        }

        Usuario autorizante = usuarioRepository.findByEmail(emailAutorizante).orElse(null);
        logAsistenciaRepository.save(LogAsistencia.builder()
                .usuario(socio)
                .tipoEvento(TipoEventoAsistencia.INGRESO_EXCEPCION)
                .resultado(ResultadoAsistencia.PERMITIDO)
                .autorizadoPor(autorizante)
                .motivoExcepcion(motivoLimpio)
                .build());

        CheckInResponse respuesta = fichaRecepcion(evaluacion, null);
        // Lo que faltaba pasa a ser un aviso: el ingreso quedó permitido por excepción
        respuesta.getAvisos().addAll(0, respuesta.getFaltas());
        respuesta.getFaltas().clear();
        respuesta.setPermitido(true);
        respuesta.setExcepcionPosible(false);
        respuesta.setResultado(ResultadoAsistencia.PERMITIDO.name());
        respuesta.setMensaje("Ingreso por excepción autorizado por "
                + (autorizante != null ? autorizante.getNombreCompleto() : "recepción") + ": " + motivoLimpio);
        return respuesta;
    }

    // Faltas que recepción puede perdonar: la deuda o los días del plan. El apto médico y la cuenta, nunca.
    // Además el admin tiene que haberlo habilitado ("Permitir ingresos por excepción" en Reglas de acceso).
    private static boolean admiteExcepcion(EvaluacionAcceso evaluacion) {
        return !evaluacion.permitido() && !evaluacion.esPersonal()
                && evaluacion.config() != null && evaluacion.config().isPermitirOverrideManual()
                && evaluacion.motivos().stream().allMatch(m -> m == ResultadoAsistencia.DENEGADO_CUOTA_VENCIDA
                        || m == ResultadoAsistencia.DENEGADO_LIMITE_SEMANAL);
    }

    /**
     * Historial de asistencia paginado por usuario.
     */
    public List<LogAsistencia> historial(Long idUsuario) {
        return logAsistenciaRepository.findByUsuarioIdUsuarioOrderByFechaHoraDesc(idUsuario);
    }

    // ---- Métodos privados ----

    static String textoDias(long dias) {
        return dias == 1 ? "1 día" : dias + " días";
    }

    static String textoEstado(EstadoUsuario estado) {
        return switch (estado) {
            case ACTIVO -> "activa";
            case INACTIVO -> "inactiva";
            case PENDIENTE -> "pendiente de activación";
            case SUSPENDIDO -> "suspendida";
            case CANCELADO -> "dada de baja";
        };
    }

    // Ej. "lun 28/09, mar 29/09"
    static String detalleDias(Collection<LocalDate> dias) {
        return dias.stream()
                .map(d -> DIAS_SEMANA[d.getDayOfWeek().getValue() - 1] + " " + d.format(FECHA_CORTA))
                .collect(Collectors.joining(", "));
    }

    private static String textoGracia(long graciaRestante) {
        return graciaRestante == 0 ? "hoy es el último" : "quedan " + textoDias(graciaRestante);
    }

    private void registrarLog(Usuario usuario, TipoEventoAsistencia tipoEvento,
                              ResultadoAsistencia resultado,
                              Double lat, Double lon, Double distancia) {
        LogAsistencia log = LogAsistencia.builder()
                .usuario(usuario)
                .tipoEvento(tipoEvento)
                .resultado(resultado)
                .latitudSocio(lat)
                .longitudSocio(lon)
                .distanciaMetros(distancia)
                .build();
        logAsistenciaRepository.save(log);
    }

    private CheckInResponse fichaBase(Usuario usuario, Double distancia) {
        return CheckInResponse.builder()
                .nombreSocio(usuario.getNombreCompleto())
                .dni(usuario.getDni())
                .rol(usuario.getRol().name())
                .distanciaMetros(distancia)
                .fechaHora(LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")))
                .build();
    }
}
