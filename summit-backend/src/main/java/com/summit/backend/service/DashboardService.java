package com.summit.backend.service;

import com.summit.backend.dto.DashboardResumenDTO;
import com.summit.backend.dto.IngresoDTO;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.ResultadoAsistencia;
import com.summit.backend.model.Rol;
import com.summit.backend.repository.LogAsistenciaRepository;
import com.summit.backend.repository.SuscripcionRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Indicadores del tablero principal y actividad de ingresos del día.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final int DIAS_POR_VENCER = 7;

    private final UsuarioRepository usuarioRepository;
    private final SuscripcionRepository suscripcionRepository;
    private final LogAsistenciaRepository logAsistenciaRepository;

    public DashboardResumenDTO resumen() {
        LocalDate hoy = LocalDate.now();
        LocalDateTime inicioDia = hoy.atStartOfDay();
        LocalDateTime finDia = hoy.atTime(LocalTime.MAX);
        LocalDateTime ahora = LocalDateTime.now();

        long sociosTotal = usuarioRepository.countByRol(Rol.SOCIO);
        long sociosActivos = usuarioRepository.countByRolAndEstado(Rol.SOCIO, EstadoUsuario.ACTIVO);
        long ingresosHoy = logAsistenciaRepository.countByFechaHoraBetween(inicioDia, finDia);
        long permitidosHoy = logAsistenciaRepository
                .countByResultadoAndFechaHoraBetween(ResultadoAsistencia.PERMITIDO, inicioDia, finDia);

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
                .ingresosUltimaHora(logAsistenciaRepository.countByFechaHoraBetween(ahora.minusHours(1), ahora))
                .build();
    }

    /**
     * Intentos de ingreso de hoy, del más reciente al más antiguo.
     */
    public List<IngresoDTO> ingresosDeHoy() {
        LocalDate hoy = LocalDate.now();
        return logAsistenciaRepository
                .findByFechaHoraBetweenOrderByFechaHoraDesc(hoy.atStartOfDay(), hoy.atTime(LocalTime.MAX))
                .stream()
                .map(log -> IngresoDTO.builder()
                        .idLog(log.getIdLog())
                        .fechaHora(log.getFechaHora())
                        .idUsuario(log.getUsuario().getIdUsuario())
                        .nombre(log.getUsuario().getNombreCompleto())
                        .dni(log.getUsuario().getDni())
                        .rol(log.getUsuario().getRol().name())
                        .resultado(log.getResultado().name())
                        .tipoEvento(log.getTipoEvento() != null ? log.getTipoEvento().name() : null)
                        .build())
                .toList();
    }
}
