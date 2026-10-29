package com.summit.backend.repository;

import com.summit.backend.model.EstadoReserva;
import com.summit.backend.model.ReservaClase;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ReservaClaseRepository extends JpaRepository<ReservaClase, Long> {
    List<ReservaClase> findBySocioIdUsuario(Long idSocio);

    @EntityGraph(attributePaths = "socio")
    List<ReservaClase> findByHorarioIdHorarioAndFechaClaseOrderByFechaReserva(Long idHorario, LocalDate fechaClase);

    long countByHorarioIdHorarioAndFechaClaseAndEstadoNot(Long idHorario, LocalDate fechaClase, EstadoReserva estado);

    boolean existsBySocioIdUsuarioAndHorarioIdHorarioAndFechaClaseAndEstadoNot(
            Long idSocio, Long idHorario, LocalDate fechaClase, EstadoReserva estado);
}
