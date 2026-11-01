package com.summit.backend.service;

import com.summit.backend.dto.DashboardResumenDTO;
import com.summit.backend.dto.IngresoDTO;
import com.summit.backend.model.ConfiguracionAcceso;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.LogAsistencia;
import com.summit.backend.model.ResultadoAsistencia;
import com.summit.backend.model.Rol;
import com.summit.backend.model.TipoEventoAsistencia;
import com.summit.backend.repository.LogAsistenciaRepository;
import com.summit.backend.repository.SuscripcionRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Indicadores del tablero principal y actividad de ingresos del día.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final int DIAS_POR_VENCER = 7;
    // Salida del personal (AsistenciaPersonalService): queda en logs_asistencia, pero no es un ingreso
    private static final TipoEventoAsistencia SALIDA = TipoEventoAsistencia.CHECKOUT;

    private final UsuarioRepository usuarioRepository;
    private final SuscripcionRepository suscripcionRepository;
    private final LogAsistenciaRepository logAsistenciaRepository;
    private final FotoSocioService fotoSocioService;
    private final ConfiguracionAccesoService configService;

    public DashboardResumenDTO resumen() {
        LocalDate hoy = LocalDate.now();
        LocalDateTime inicioDia = hoy.atStartOfDay();
        LocalDateTime finDia = hoy.atTime(LocalTime.MAX);
        LocalDateTime ahora = LocalDateTime.now();

        long sociosTotal = usuarioRepository.countByRol(Rol.SOCIO);
        // Activo = cuenta activa y membresía al día (con los días de gracia): con la cuota vencida cuenta como inactivo,
        // igual que en la lista de socios
        ConfiguracionAcceso config = configService.obtenerConfiguracionGlobal();
        long sociosActivos = config.isRequerirMembresiaActiva()
                ? usuarioRepository.countConMembresiaAlDia(Rol.SOCIO, EstadoUsuario.ACTIVO,
                        hoy.minusDays(config.getDiasGraciaMembresia()))
                : usuarioRepository.countByRolAndEstado(Rol.SOCIO, EstadoUsuario.ACTIVO);
        // Las salidas del personal (CHECKOUT) no son ingresos
        long ingresosHoy = logAsistenciaRepository.countByTipoEventoNotAndFechaHoraBetween(SALIDA, inicioDia, finDia);
        long permitidosHoy = logAsistenciaRepository
                .countByResultadoAndTipoEventoNotAndFechaHoraBetween(ResultadoAsistencia.PERMITIDO, SALIDA, inicioDia, finDia);

        return DashboardResumenDTO.builder()
                .sociosTotal(sociosTotal)
                .sociosActivos(sociosActivos)
                .sociosInactivos(sociosTotal - sociosActivos)
                .nuevosEsteMes(usuarioRepository.countByRolAndFechaCreacionGreaterThanEqual(
                        Rol.SOCIO, hoy.withDayOfMonth(1).atStartOfDay()))
                .membresiasPorVencer(suscripcionRepository.countByActivaTrueAndFechaVencimientoBetween(
                        hoy, hoy.plusDays(DIAS_POR_VENCER)))
                .ingresosHoy(ingresosHoy)
                .permitidosHoy(permitidosHoy)
                .denegadosHoy(ingresosHoy - permitidosHoy)
                .ingresosUltimaHora(logAsistenciaRepository.countByTipoEventoNotAndFechaHoraBetween(SALIDA, ahora.minusHours(1), ahora))
                .build();
    }

    /**
     * Intentos de ingreso de hoy, del más reciente al más antiguo. Sin las salidas del personal: esas se ven en
     * Asistencia del personal.
     */
    public List<IngresoDTO> ingresosDeHoy() {
        LocalDate hoy = LocalDate.now();
        LocalDateTime inicio = hoy.atStartOfDay();
        LocalDateTime fin = hoy.atTime(LocalTime.MAX);
        List<LogAsistencia> logs = logAsistenciaRepository
                .findByTipoEventoNotAndFechaHoraBetweenOrderByFechaHoraDesc(SALIDA, inicio, fin);
        Map<Long, Long> fotos = fotoSocioService.versiones(
                logs.stream().map(log -> log.getUsuario().getIdUsuario()).collect(Collectors.toSet()));
        return logs.stream()
                .map(log -> IngresoDTO.builder()
                            .idLog(log.getIdLog())
                            .fechaHora(log.getFechaHora())
                            .idUsuario(log.getUsuario().getIdUsuario())
                            .nombre(log.getUsuario().getNombreCompleto())
                            .dni(log.getUsuario().getDni())
                            .rol(log.getUsuario().getRol().name())
                            .resultado(log.getResultado().name())
                            .tipoEvento(log.getTipoEvento() != null ? log.getTipoEvento().name() : null)
                            .fotoVersion(fotos.get(log.getUsuario().getIdUsuario()))
                            .build())
                .toList();
    }
}
