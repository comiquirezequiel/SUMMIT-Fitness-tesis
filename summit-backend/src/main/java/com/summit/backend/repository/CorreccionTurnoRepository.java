package com.summit.backend.repository;

import com.summit.backend.model.CorreccionTurno;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CorreccionTurnoRepository extends JpaRepository<CorreccionTurno, Long> {

    // Correcciones de varios turnos (con quién las hizo), de la más vieja a la más nueva
    @EntityGraph(attributePaths = "autor")
    List<CorreccionTurno> findByTurnoIdTurnoInOrderByFechaAscIdCorreccionAsc(Collection<Long> idsTurno);

    boolean existsByTurnoIdTurno(Long idTurno);
}
