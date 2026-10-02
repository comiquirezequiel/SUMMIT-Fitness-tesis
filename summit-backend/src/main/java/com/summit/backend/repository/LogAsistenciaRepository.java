package com.summit.backend.repository;

import com.summit.backend.model.LogAsistencia;
import com.summit.backend.model.ResultadoAsistencia;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface LogAsistenciaRepository extends JpaRepository<LogAsistencia, Long> {
    List<LogAsistencia> findByUsuarioIdUsuarioOrderByFechaHoraDesc(Long idUsuario);

    // Últimos ingresos de un usuario, del más nuevo al más viejo (el Pageable limita cuántos)
    List<LogAsistencia> findByUsuarioIdUsuarioOrderByFechaHoraDescIdLogDesc(Long idUsuario, Pageable pageable);

    @EntityGraph(attributePaths = "usuario")
    List<LogAsistencia> findByFechaHoraBetweenOrderByFechaHoraDesc(LocalDateTime inicio, LocalDateTime fin);

    long countByFechaHoraBetween(LocalDateTime desde, LocalDateTime hasta);
    long countByResultadoAndFechaHoraBetween(ResultadoAsistencia resultado, LocalDateTime desde, LocalDateTime hasta);

    // Ingresos de un socio con un resultado dado en un rango (se usa para el límite semanal)
    List<LogAsistencia> findByUsuarioIdUsuarioAndResultadoAndFechaHoraBetween(
            Long idUsuario, ResultadoAsistencia resultado, LocalDateTime desde, LocalDateTime hasta);
    
    @Query("SELECT COUNT(l) FROM LogAsistencia l WHERE l.fechaHora >= :desde AND l.resultado = 'PERMITIDO'")
    long countCheckinsHoy(LocalDateTime desde);
}
