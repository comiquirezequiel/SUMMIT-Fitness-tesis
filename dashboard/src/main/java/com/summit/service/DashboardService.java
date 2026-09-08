package com.summit.service;

import com.summit.dto.DashboardMetricasDTO;
import com.summit.model.enums.EstadoUsuario;
import com.summit.repository.AsistenciaLogRepository;
import com.summit.repository.PagoRepository;
import com.summit.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service // Indica que contiene la lógica de negocio
public class DashboardService {

    // Inyección de dependencias
    @Autowired
    private PagoRepository pagoRepository;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private AsistenciaLogRepository asistenciaLogRepository;

    @Transactional(readOnly = true)
    public DashboardMetricasDTO obtenerMetricasMensuales() {
        DashboardMetricasDTO metricas = new DashboardMetricasDTO();

        // 1. Calcular rango de fechas (Desde el día 1 del mes actual hasta el último)
        YearMonth mesActual = YearMonth.now();
        LocalDateTime inicioMes = mesActual.atDay(1).atStartOfDay();
        LocalDateTime finMes = mesActual.atEndOfMonth().atTime(23, 59, 59);

        // 2. Ingresos del Mes
        BigDecimal ingresos = pagoRepository.calcularIngresosDelMes(inicioMes, finMes);
        metricas.setIngresosDelMes(ingresos != null ? ingresos : BigDecimal.ZERO);

        // 3. Socios Activos
        long activos = usuarioRepository.countByEstado(EstadoUsuario.ACTIVO);
        metricas.setTotalSociosActivos(activos);

        // 4. Calcular Retención (Fórmula: Socios únicos que vinieron este mes / Total de activos * 100)
        // Nota: En un entorno real haríamos un COUNT(DISTINCT usuario_id) en el repositorio.
        // Aquí simulamos la métrica para el dashboard.
        long asistenciasDelMes = asistenciaLogRepository.findByFechaHoraBetween(inicioMes, finMes).size();
        double retencion = activos == 0 ? 0 : Math.min(100.0, ((double) asistenciasDelMes / activos) * 100);
        metricas.setPorcentajeRetencion(Math.round(retencion * 100.0) / 100.0); // Redondear a 2 decimales

        // 5. Mapear Horas Pico
        List<Object[]> resultadosHoras = asistenciaLogRepository.calcularHorasPico();
        Map<Integer, Long> mapaHoras = new LinkedHashMap<>();
        for (Object[] fila : resultadosHoras) {
            Integer hora = ((Number) fila[0]).intValue();
            Long cantidad = ((Number) fila[1]).longValue();
            mapaHoras.put(hora, cantidad);
        }
        metricas.setHorasPico(mapaHoras);

        // --- NUEVAS MÉTRICAS ---
        
        // Ingresos de Hoy
        LocalDateTime inicioDia = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime finDia = LocalDateTime.now().toLocalDate().atTime(23, 59, 59);
        BigDecimal ingresosHoy = pagoRepository.calcularIngresosDelDia(inicioDia, finDia);
        metricas.setIngresosDeHoy(ingresosHoy != null ? ingresosHoy : BigDecimal.ZERO);

        // Nuevos este Mes
        long nuevos = usuarioRepository.countByFechaRegistroBetween(inicioMes, finMes);
        metricas.setNuevosEsteMes(nuevos);

        // Solicitudes de Baja (Asumimos usuarios Inactivos temporalmente)
        long bajas = usuarioRepository.countByEstado(EstadoUsuario.INACTIVO);
        metricas.setSolicitudesDeBaja(bajas);

        return metricas;
    }
}