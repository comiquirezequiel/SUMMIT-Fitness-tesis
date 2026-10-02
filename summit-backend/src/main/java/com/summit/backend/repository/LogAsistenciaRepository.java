package com.summit.backend.repository;

import com.summit.backend.model.LogAsistencia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface LogAsistenciaRepository extends JpaRepository<LogAsistencia, Long> {
    List<LogAsistencia> findByUsuarioIdUsuarioOrderByFechaHoraDesc(Long idUsuario);
    List<LogAsistencia> findByFechaHoraBetweenOrderByFechaHoraDesc(LocalDateTime inicio, LocalDateTime fin);
    
    @Query("SELECT COUNT(l) FROM LogAsistencia l WHERE l.fechaHora >= :desde AND l.resultado = 'PERMITIDO'")
    long countCheckinsHoy(LocalDateTime desde);
}
