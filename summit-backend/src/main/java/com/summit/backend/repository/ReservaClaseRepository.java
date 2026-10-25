package com.summit.backend.repository;

import com.summit.backend.model.EstadoReserva;
import com.summit.backend.model.ReservaClase;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface ReservaClaseRepository extends JpaRepository<ReservaClase, Long> {
    List<ReservaClase> findBySocioIdUsuario(Long idSocio);

    @EntityGraph(attributePaths = "socio")
    List<ReservaClase> findByHorarioIdHorarioAndFechaClaseOrderByFechaReserva(Long idHorario, LocalDate fechaClase);

    long countByHorarioIdHorarioAndFechaClaseAndEstadoNot(Long idHorario, LocalDate fechaClase, EstadoReserva estado);

    boolean existsBySocioIdUsuarioAndHorarioIdHorarioAndFechaClaseAndEstadoNot(
            Long idSocio, Long idHorario, LocalDate fechaClase, EstadoReserva estado);

    // Filas [idHorario, fechaClase, cantidad] de las reservas de un rango de fechas, sin las de un estado
    // (cupos ocupados de toda la agenda en una sola consulta)
    @Query("SELECT r.horario.idHorario, r.fechaClase, COUNT(r) FROM ReservaClase r " +
            "WHERE r.fechaClase BETWEEN :desde AND :hasta AND r.estado <> :excluido " +
            "GROUP BY r.horario.idHorario, r.fechaClase")
    List<Object[]> contarPorHorarioYFecha(@Param("desde") LocalDate desde, @Param("hasta") LocalDate hasta,
                                          @Param("excluido") EstadoReserva excluido);

    // Reservas de un socio en un rango de fechas, sin las de un estado (portal del socio)
    List<ReservaClase> findBySocioIdUsuarioAndFechaClaseBetweenAndEstadoNot(
            Long idSocio, LocalDate desde, LocalDate hasta, EstadoReserva estado);

    // Reservas de un socio desde una fecha, con la clase y el profesor en la misma consulta (portal del socio).
    // JOIN FETCH y no @EntityGraph: con el ORDER BY por la hora, el grafo de tres niveles no traía al profesor
    @Query("SELECT r FROM ReservaClase r JOIN FETCH r.horario h JOIN FETCH h.clase c LEFT JOIN FETCH c.profesor " +
            "WHERE r.socio.idUsuario = :idSocio AND r.fechaClase >= :desde " +
            "ORDER BY r.fechaClase, h.horaInicio, r.idReserva")
    List<ReservaClase> buscarDelSocioDesde(@Param("idSocio") Long idSocio, @Param("desde") LocalDate desde);

    // Reservas confirmadas de una fecha cuya clase empieza después de "desde" y hasta "hasta", con el socio y la
    // clase (recordatorio de clase)
    @Query("SELECT r FROM ReservaClase r JOIN FETCH r.horario h JOIN FETCH h.clase JOIN FETCH r.socio "
            + "WHERE r.fechaClase = :fecha AND r.estado = com.summit.backend.model.EstadoReserva.CONFIRMADA "
            + "AND h.horaInicio > :desde AND h.horaInicio <= :hasta")
    List<ReservaClase> confirmadasQueEmpiezanEntre(@Param("fecha") LocalDate fecha, @Param("desde") LocalTime desde,
                                                   @Param("hasta") LocalTime hasta);
}
