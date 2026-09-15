package com.summit.repository;

import com.summit.model.entity.AsistenciaLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import com.summit.model.enums.ResultadoAcceso;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AsistenciaLogRepository extends JpaRepository<AsistenciaLog, Long> {

    // 1. NUEVO: Filtramos la lista de asistencias exigiendo que el resultado coincida con una lista válida
    List<AsistenciaLog> findByFechaHoraBetweenAndResultadoIn(
        LocalDateTime inicio, 
        LocalDateTime fin, 
        List<ResultadoAcceso> resultadosValidos
    );

    // 2. CORRECCIÓN SQL: Le agregamos la cláusula AND resultado IN (...) para no sumar los rechazos
    @Query(value = "SELECT HOUR(fecha_hora) as hora, COUNT(*) as cantidad " +
                   "FROM logs_asistencia " +
                   "WHERE tipo_evento = 'ENTRADA' " + 
                   "AND resultado IN ('ACCESO_PERMITIDO', 'ACCESO_FORZADO') " +
                   "GROUP BY HOUR(fecha_hora) " +
                   "ORDER BY hora ASC", 
           nativeQuery = true)
    List<Object[]> calcularHorasPico();
}