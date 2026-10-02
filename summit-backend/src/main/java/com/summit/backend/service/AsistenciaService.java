package com.summit.backend.service;

import com.summit.backend.dto.CheckInRequest;
import com.summit.backend.dto.CheckInResponse;
import com.summit.backend.model.*;
import com.summit.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Servicio de asistencia y check-in.
 * El ingreso en recepción evalúa todas las reglas y devuelve una ficha con:
 * 1. Estado de la cuenta
 * 2. Cuota al día (con días de gracia)
 * 3. Límite semanal del plan (ej. 3 veces por semana)
 * 4. Certificado médico vigente (Ley 5397, con días de gracia)
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

    // Con cuántos días de anticipación se avisa en recepción que algo está por vencer
    private static final int DIAS_AVISO_CUOTA = 7;
    private static final int DIAS_AVISO_APTO = 15;

    private static final DateTimeFormatter FECHA_CORTA = DateTimeFormatter.ofPattern("dd/MM");
    private static final String[] DIAS_SEMANA = {"lun", "mar", "mié", "jue", "vie", "sáb", "dom"};

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
     * Evalúa todas las reglas (no se detiene en la primera falta) y registra el intento.
     * Si hay varias faltas, el resultado registrado es la primera según este orden:
     * cuenta → cuota → límite semanal → apto médico.
     */
    private CheckInResponse validarAccesoInterno(Usuario usuario, TipoEventoAsistencia tipoEvento, Double distancia) {
        CheckInResponse respuesta = fichaBase(usuario, distancia);
        List<ResultadoAsistencia> motivos = new ArrayList<>();

        if (usuario.getEstado() != EstadoUsuario.ACTIVO) {
            motivos.add(ResultadoAsistencia.DENEGADO_CUENTA_INACTIVA);
            respuesta.getFaltas().add("Cuenta " + textoEstado(usuario.getEstado()) + ": no puede ingresar");
        }

        if (usuario.getRol() != Rol.SOCIO) {
            // Personal del gimnasio: el ingreso queda registrado como presentismo, sin controles de socio
            if (motivos.isEmpty()) {
                respuesta.getAvisos().add("Personal del gimnasio (" + usuario.getRol().name() + "): se registra su ingreso");
            }
            return cerrarEvaluacion(usuario, tipoEvento, distancia, respuesta, motivos, null);
        }

        ConfiguracionAcceso config = configService.obtenerConfiguracionGlobal();
        LocalDate hoy = LocalDate.now();

        Suscripcion suscripcion = suscripcionRepository
                .findFirstByUsuarioIdUsuarioAndActivaTrueOrderByFechaVencimientoDesc(usuario.getIdUsuario())
                .orElse(null);

        evaluarCuota(suscripcion, config, hoy, respuesta, motivos);
        Semana semana = evaluarLimiteSemanal(usuario, suscripcion, config, hoy, respuesta, motivos);
        evaluarAptoMedico(usuario, config, hoy, respuesta, motivos);

        return cerrarEvaluacion(usuario, tipoEvento, distancia, respuesta, motivos, semana);
    }

    private void evaluarCuota(Suscripcion suscripcion, ConfiguracionAcceso config, LocalDate hoy,
                              CheckInResponse respuesta, List<ResultadoAsistencia> motivos) {
        if (suscripcion != null) {
            long dias = ChronoUnit.DAYS.between(hoy, suscripcion.getFechaVencimiento());
            respuesta.setPlan(suscripcion.getPlan().getNombrePlan());
            respuesta.setVencimientoCuota(suscripcion.getFechaVencimiento());
            respuesta.setDiasParaVencerCuota(dias);
        }

        if (!config.isRequerirMembresiaActiva()) {
            return;
        }

        if (suscripcion == null) {
            motivos.add(ResultadoAsistencia.DENEGADO_CUOTA_VENCIDA);
            respuesta.getFaltas().add("No tiene una membresía activa");
            return;
        }

        String vence = suscripcion.getFechaVencimiento().format(FECHA_CORTA);
        long dias = respuesta.getDiasParaVencerCuota();
        if (dias < 0) {
            long graciaRestante = config.getDiasGraciaMembresia() + dias;
            if (graciaRestante < 0) {
                motivos.add(ResultadoAsistencia.DENEGADO_CUOTA_VENCIDA);
                respuesta.getFaltas().add("Cuota vencida el " + vence + " (hace " + textoDias(-dias) + ")");
            } else {
                respuesta.getAvisos().add("Cuota vencida el " + vence + ": ingresa por días de gracia ("
                        + (graciaRestante == 0 ? "hoy es el último" : "quedan " + textoDias(graciaRestante)) + ")");
            }
        } else if (dias == 0) {
            respuesta.getAvisos().add("La cuota vence hoy");
        } else if (dias <= DIAS_AVISO_CUOTA) {
            respuesta.getAvisos().add("La cuota vence en " + textoDias(dias) + " (" + vence + ")");
        }
    }

    /**
     * Cuenta los días distintos (lunes a domingo) con un ingreso permitido.
     * Volver a entrar el mismo día no descuenta otro día.
     */
    private Semana evaluarLimiteSemanal(Usuario usuario, Suscripcion suscripcion, ConfiguracionAcceso config,
                                        LocalDate hoy, CheckInResponse respuesta,
                                        List<ResultadoAsistencia> motivos) {
        if (suscripcion == null) {
            return null;
        }

        LocalDate lunes = hoy.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        TreeSet<LocalDate> diasConIngreso = logAsistenciaRepository
                .findByUsuarioIdUsuarioAndResultadoAndFechaHoraBetween(usuario.getIdUsuario(),
                        ResultadoAsistencia.PERMITIDO, lunes.atStartOfDay(), hoy.atTime(LocalTime.MAX))
                .stream()
                .map(log -> log.getFechaHora().toLocalDate())
                .collect(Collectors.toCollection(TreeSet::new));

        Integer permitidos = suscripcion.getPlan().getVecesPorSemana();
        Semana semana = new Semana(permitidos, diasConIngreso.size(), diasConIngreso.contains(hoy));

        if (permitidos != null && config.isRequerirMembresiaActiva()
                && !semana.yaIngresoHoy() && semana.usados() >= permitidos) {
            String detalle = diasConIngreso.stream()
                    .map(d -> DIAS_SEMANA[d.getDayOfWeek().getValue() - 1] + " " + d.format(FECHA_CORTA))
                    .collect(Collectors.joining(", "));
            motivos.add(ResultadoAsistencia.DENEGADO_LIMITE_SEMANAL);
            respuesta.getFaltas().add("Excedió los días semanales de su plan: ya usó "
                    + semana.usados() + " de " + permitidos + " (" + detalle + ")");
        }
        return semana;
    }

    private void evaluarAptoMedico(Usuario usuario, ConfiguracionAcceso config, LocalDate hoy,
                                   CheckInResponse respuesta, List<ResultadoAsistencia> motivos) {
        Optional<CertificadoMedico> certificado = certificadoMedicoRepository
                .findFirstByUsuarioIdUsuarioOrderByFechaVencimientoDesc(usuario.getIdUsuario());

        certificado.ifPresent(cert -> {
            respuesta.setVencimientoApto(cert.getFechaVencimiento());
            respuesta.setDiasParaVencerApto(ChronoUnit.DAYS.between(hoy, cert.getFechaVencimiento()));
        });

        if (!config.isRequerirCertificadoMedico()) {
            return;
        }

        if (certificado.isEmpty()) {
            motivos.add(ResultadoAsistencia.DENEGADO_CERTIFICADO_MEDICO);
            respuesta.getFaltas().add("No tiene certificado médico (apto físico) cargado");
            return;
        }
        if (certificado.get().getEstadoLegal() == EstadoLegalCertificado.RECHAZADO) {
            motivos.add(ResultadoAsistencia.DENEGADO_CERTIFICADO_MEDICO);
            respuesta.getFaltas().add("Su último certificado médico fue rechazado");
            return;
        }

        String vence = certificado.get().getFechaVencimiento().format(FECHA_CORTA);
        long dias = respuesta.getDiasParaVencerApto();
        if (dias < 0) {
            long graciaRestante = config.getDiasGraciaCertificado() + dias;
            if (graciaRestante < 0) {
                motivos.add(ResultadoAsistencia.DENEGADO_CERTIFICADO_MEDICO);
                respuesta.getFaltas().add("Apto médico vencido el " + vence + " (hace " + textoDias(-dias) + ")");
            } else {
                respuesta.getAvisos().add("Apto médico vencido el " + vence + ": ingresa por días de gracia ("
                        + (graciaRestante == 0 ? "hoy es el último" : "quedan " + textoDias(graciaRestante)) + ")");
            }
        } else if (dias == 0) {
            respuesta.getAvisos().add("El apto médico vence hoy");
        } else if (dias <= DIAS_AVISO_APTO) {
            respuesta.getAvisos().add("El apto médico vence en " + textoDias(dias) + " (" + vence + ")");
        }
    }

    /**
     * Define el resultado final, completa los días de la semana y registra el intento en el log.
     */
    private CheckInResponse cerrarEvaluacion(Usuario usuario, TipoEventoAsistencia tipoEvento, Double distancia,
                                             CheckInResponse respuesta, List<ResultadoAsistencia> motivos,
                                             Semana semana) {
        boolean permitido = motivos.isEmpty();
        ResultadoAsistencia resultado = permitido ? ResultadoAsistencia.PERMITIDO : motivos.get(0);

        if (semana != null) {
            int usados = semana.usados() + (permitido && !semana.yaIngresoHoy() ? 1 : 0);
            respuesta.setDiasSemanaPermitidos(semana.permitidos());
            respuesta.setDiasSemanaUsados(usados);
            if (semana.permitidos() != null) {
                int restantes = Math.max(0, semana.permitidos() - usados);
                respuesta.setDiasSemanaRestantes(restantes);
                if (permitido && restantes == 0 && !semana.yaIngresoHoy()) {
                    respuesta.getAvisos().add("Hoy usa su último día disponible de la semana");
                }
            }
            if (permitido && semana.yaIngresoHoy()) {
                respuesta.getAvisos().add("Ya había ingresado hoy: no descuenta otro día");
            }
        }

        respuesta.setPermitido(permitido);
        respuesta.setResultado(resultado.name());
        respuesta.setMensaje(permitido ? "Acceso permitido" : String.join(" · ", respuesta.getFaltas()));

        registrarLog(usuario, tipoEvento, resultado, null, null, distancia);
        return respuesta;
    }

    /**
     * Historial de asistencia paginado por usuario.
     */
    public List<LogAsistencia> historial(Long idUsuario) {
        return logAsistenciaRepository.findByUsuarioIdUsuarioOrderByFechaHoraDesc(idUsuario);
    }

    // ---- Métodos privados ----

    // Uso del plan en la semana actual (permitidos null = pase libre)
    private record Semana(Integer permitidos, int usados, boolean yaIngresoHoy) {}

    private static String textoDias(long dias) {
        return dias == 1 ? "1 día" : dias + " días";
    }

    private static String textoEstado(EstadoUsuario estado) {
        return switch (estado) {
            case ACTIVO -> "activa";
            case INACTIVO -> "inactiva";
            case PENDIENTE -> "pendiente de activación";
            case SUSPENDIDO -> "suspendida";
            case CANCELADO -> "dada de baja";
        };
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
