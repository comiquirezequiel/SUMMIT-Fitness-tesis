package com.summit.backend.repository;

import com.summit.backend.model.LogAsistencia;
import com.summit.backend.model.ResultadoAsistencia;
import com.summit.backend.model.TipoEventoAsistencia;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface LogAsistenciaRepository extends JpaRepository<LogAsistencia, Long> {
    List<LogAsistencia> findByUsuarioIdUsuarioOrderByFechaHoraDesc(Long idUsuario);

    // Últimos ingresos de un usuario, del más nuevo al más viejo (el Pageable limita cuántos)
    List<LogAsistencia> findByUsuarioIdUsuarioOrderByFechaHoraDescIdLogDesc(Long idUsuario, Pageable pageable);

    @EntityGraph(attributePaths = "usuario")
    List<LogAsistencia> findByFechaHoraBetweenOrderByFechaHoraDesc(LocalDateTime inicio, LocalDateTime fin);

    // Solo los posteriores a un ingreso ya conocido (el tablero pregunta seguido si hay nuevos)
    @EntityGraph(attributePaths = "usuario")
    List<LogAsistencia> findByFechaHoraBetweenAndIdLogGreaterThanOrderByFechaHoraDesc(
            LocalDateTime inicio, LocalDateTime fin, Long idLog);

    long countByFechaHoraBetween(LocalDateTime desde, LocalDateTime hasta);
    long countByResultadoAndFechaHoraBetween(ResultadoAsistencia resultado, LocalDateTime desde, LocalDateTime hasta);

    // Tablero de recepción: los ingresos sin las salidas del personal (tipo CHECKOUT, ver AsistenciaPersonalService)
    @EntityGraph(attributePaths = "usuario")
    List<LogAsistencia> findByTipoEventoNotAndFechaHoraBetweenOrderByFechaHoraDesc(
            TipoEventoAsistencia tipoEvento, LocalDateTime inicio, LocalDateTime fin);

    @EntityGraph(attributePaths = "usuario")
    List<LogAsistencia> findByTipoEventoNotAndFechaHoraBetweenAndIdLogGreaterThanOrderByFechaHoraDesc(
            TipoEventoAsistencia tipoEvento, LocalDateTime inicio, LocalDateTime fin, Long idLog);

    long countByTipoEventoNotAndFechaHoraBetween(TipoEventoAsistencia tipoEvento, LocalDateTime desde, LocalDateTime hasta);
    long countByResultadoAndTipoEventoNotAndFechaHoraBetween(ResultadoAsistencia resultado, TipoEventoAsistencia tipoEvento,
                                                             LocalDateTime desde, LocalDateTime hasta);

    // Ingresos de un socio con un resultado dado en un rango (se usa para el límite semanal)
    List<LogAsistencia> findByUsuarioIdUsuarioAndResultadoAndFechaHoraBetween(
            Long idUsuario, ResultadoAsistencia resultado, LocalDateTime desde, LocalDateTime hasta);
    
    @Query("SELECT COUNT(l) FROM LogAsistencia l WHERE l.fechaHora >= :desde AND l.resultado = 'PERMITIDO'")
    long countCheckinsHoy(LocalDateTime desde);

    // Métricas: ingresos efectivos de socios (permitidos, sin contar las salidas ni el presentismo del personal) de un
    // rango, como filas [fechaHora, idUsuario, tipoEvento]
    @Query("SELECT l.fechaHora, l.usuario.idUsuario, l.tipoEvento FROM LogAsistencia l "
            + "WHERE l.resultado = com.summit.backend.model.ResultadoAsistencia.PERMITIDO "
            + "AND l.tipoEvento <> com.summit.backend.model.TipoEventoAsistencia.CHECKOUT "
            + "AND l.usuario.rol = com.summit.backend.model.Rol.SOCIO "
            + "AND l.fechaHora >= :desde AND l.fechaHora < :hasta")
    List<Object[]> ingresosPermitidos(@Param("desde") LocalDateTime desde, @Param("hasta") LocalDateTime hasta);

    // Ocupación: ingresos efectivos de socios (sin el personal) de un rango, como filas [fechaHora, idUsuario]
    @Query("SELECT l.fechaHora, l.usuario.idUsuario FROM LogAsistencia l "
            + "WHERE l.resultado = com.summit.backend.model.ResultadoAsistencia.PERMITIDO "
            + "AND l.tipoEvento <> com.summit.backend.model.TipoEventoAsistencia.CHECKOUT "
            + "AND l.usuario.rol = com.summit.backend.model.Rol.SOCIO "
            + "AND l.fechaHora >= :desde AND l.fechaHora < :hasta")
    List<Object[]> ingresosDeSocios(@Param("desde") LocalDateTime desde, @Param("hasta") LocalDateTime hasta);
}
