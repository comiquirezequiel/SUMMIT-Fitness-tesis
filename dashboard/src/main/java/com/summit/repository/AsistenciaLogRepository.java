package com.summit.repository;

import com.summit.model.entity.AsistenciaLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AsistenciaLogRepository extends JpaRepository<AsistenciaLog, Long> {

    // Retorna todos los accesos en un período de tiempo (útil para KPI de Retención/Uso)
    List<AsistenciaLog> findByFechaHoraBetween(LocalDateTime inicio, LocalDateTime fin);

    // Métrica Avanzada para Dashboard: Agrupa las entradas por hora para saber el "Pico" de gente.
    // Retorna un array de objetos donde [0] es la hora (ej. 18) y [1] es la cantidad de personas.
    @Query(value = "SELECT HOUR(fecha_hora) as hora, COUNT(*) as cantidad " +
                   "FROM logs_asistencia " +
                   "WHERE tipo_evento = 'ENTRADA' " +
                   "GROUP BY HOUR(fecha_hora) " +
                   "ORDER BY hora ASC", 
           nativeQuery = true)
    List<Object[]> calcularHorasPico();
}