package com.summit.backend.service;

import com.summit.backend.dto.CheckInRequest;
import com.summit.backend.dto.CheckInResponse;
import com.summit.backend.model.*;
import com.summit.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Servicio de asistencia y check-in.
 * Implementa la validación integral con:
 * 1. Cooldown anti-spam (30 segundos entre intentos)
 * 2. Verificación de cuota al día
 * 3. Verificación de certificado médico vigente
 * 4. Geolocalización Haversine (< 20 metros)
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
    private final CertificadoMedicoService certificadoMedicoService;

    // Mapa de cooldown: idUsuario -> último intento
    private final ConcurrentHashMap<Long, LocalDateTime> cooldownMap = new ConcurrentHashMap<>();

    private static final int COOLDOWN_SEGUNDOS = 30;

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

        // Verificar que sea un socio activo
        if (socio.getEstado() != EstadoUsuario.ACTIVO) {
            return buildResponse(false, ResultadoAsistencia.DENEGADO_CUOTA_VENCIDA,
                    "La cuenta del socio se encuentra " + socio.getEstado().name().toLowerCase(),
                    null, socio);
        }

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

            return buildResponse(false, ResultadoAsistencia.DENEGADO_FUERA_DE_RANGO_GPS,
                    String.format("Fuera de rango GPS. Distancia: %.1f metros (máx. 20m)", distancia),
                    distancia, socio);
        }

        return validarAccesoInterno(socio, tipoEvento, distancia);
    }

    /**
     * RF-06: Validar acceso en molinete (recepción) sin GPS.
     */
    public CheckInResponse verificarAccesoMolinete(String dni) {
        if (dni == null || dni.isEmpty()) {
            throw new RuntimeException("Debe proporcionar un DNI");
        }

        Usuario socio = usuarioRepository.findByDni(dni)
                .orElseThrow(() -> new RuntimeException("No se encontró un socio con DNI: " + dni));

        if (socio.getEstado() != EstadoUsuario.ACTIVO) {
            return buildResponse(false, ResultadoAsistencia.DENEGADO_CUOTA_VENCIDA,
                    "La cuenta del socio se encuentra " + socio.getEstado().name().toLowerCase(),
                    null, socio);
        }
        
        return validarAccesoInterno(socio, TipoEventoAsistencia.INGRESO_MOLINETE, null);
    }
    
    private CheckInResponse validarAccesoInterno(Usuario socio, TipoEventoAsistencia tipoEvento, Double distancia) {
        com.summit.backend.model.ConfiguracionAcceso config = configService.obtenerConfiguracionGlobal();

        // Verificar suscripción activa (Finanzas)
        if (config.isRequerirMembresiaActiva()) {
            Optional<Suscripcion> suscripcionOpt = suscripcionRepository
                    .findFirstByUsuarioIdUsuarioAndActivaTrueOrderByFechaVencimientoDesc(socio.getIdUsuario());

            boolean membresiaValida = false;
            if (suscripcionOpt.isPresent()) {
                LocalDate limite = suscripcionOpt.get().getFechaVencimiento().plusDays(config.getDiasGraciaMembresia());
                membresiaValida = !LocalDate.now().isAfter(limite);
            }

            if (!membresiaValida) {
                registrarLog(socio, tipoEvento, ResultadoAsistencia.DENEGADO_CUOTA_VENCIDA, null, null, distancia);
                return buildResponse(false, ResultadoAsistencia.DENEGADO_CUOTA_VENCIDA,
                        "Deuda Pendiente (Cuota Vencida)", distancia, socio);
            }
        }

        // Verificar certificado médico (Salud)
        if (config.isRequerirCertificadoMedico()) {
            boolean aptoVigente = certificadoMedicoService.isAptoMedicoVigente(socio.getIdUsuario());
            if (!aptoVigente) {
                registrarLog(socio, tipoEvento, ResultadoAsistencia.DENEGADO_CERTIFICADO_MEDICO, null, null, distancia);
                return buildResponse(false, ResultadoAsistencia.DENEGADO_CERTIFICADO_MEDICO,
                        "Apto Médico Vencido", distancia, socio);
            }
        }

        // Todo OK → Permitir ingreso
        registrarLog(socio, tipoEvento, ResultadoAsistencia.PERMITIDO, null, null, distancia);
        return buildResponse(true, ResultadoAsistencia.PERMITIDO,
                "Acceso Permitido", distancia, socio);
    }

    /**
     * Historial de asistencia paginado por usuario.
     */
    public List<LogAsistencia> historial(Long idUsuario) {
        return logAsistenciaRepository.findByUsuarioIdUsuarioOrderByFechaHoraDesc(idUsuario);
    }

    // ---- Métodos privados ----

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

    private CheckInResponse buildResponse(boolean permitido, ResultadoAsistencia resultado,
                                           String mensaje, Double distancia, Usuario socio) {
        return CheckInResponse.builder()
                .permitido(permitido)
                .resultado(resultado.name())
                .mensaje(mensaje)
                .distanciaMetros(distancia)
                .fechaHora(LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")))
                .nombreSocio(socio.getNombreCompleto())
                .build();
    }
}
