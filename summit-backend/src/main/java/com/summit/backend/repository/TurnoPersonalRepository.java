package com.summit.backend.repository;

import com.summit.backend.model.TurnoPersonal;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TurnoPersonalRepository extends JpaRepository<TurnoPersonal, Long> {

    // El último turno de una persona (sin los anulados): decide si su paso por recepción es entrada o salida
    Optional<TurnoPersonal> findFirstByUsuarioIdUsuarioAndAnuladoFalseOrderByEntradaDescIdTurnoDesc(Long idUsuario);

    // El turno anterior a uno (sin los anulados)
    Optional<TurnoPersonal> findFirstByUsuarioIdUsuarioAndAnuladoFalseAndIdTurnoNotAndEntradaLessThanEqualOrderByEntradaDescIdTurnoDesc(
            Long idUsuario, Long idTurno, LocalDateTime entrada);

    // Turnos de una persona que empezaron entre dos momentos (para que no se superpongan al corregir)
    List<TurnoPersonal> findByUsuarioIdUsuarioAndAnuladoFalseAndEntradaBetween(Long idUsuario, LocalDateTime desde, LocalDateTime hasta);

    // ¿Tiene algún turno que empezó después de ese momento? (sin salida solo puede quedar el último)
    boolean existsByUsuarioIdUsuarioAndAnuladoFalseAndIdTurnoNotAndEntradaAfter(Long idUsuario, Long idTurno, LocalDateTime entrada);

    // Turnos que empezaron en un rango (con la persona), del más viejo al más nuevo
    @EntityGraph(attributePaths = "usuario")
    List<TurnoPersonal> findByEntradaGreaterThanEqualAndEntradaLessThanOrderByEntradaAscIdTurnoAsc(LocalDateTime desde, LocalDateTime hasta);

    // Turnos que empezaron desde un momento (los candidatos a estar en curso)
    @EntityGraph(attributePaths = "usuario")
    List<TurnoPersonal> findByAnuladoFalseAndEntradaGreaterThanEqual(LocalDateTime desde);

    // Turnos sin salida que empezaron desde un momento (en curso u olvidados)
    @EntityGraph(attributePaths = "usuario")
    List<TurnoPersonal> findBySalidaIsNullAndAnuladoFalseAndEntradaGreaterThanEqualOrderByEntradaAscIdTurnoAsc(LocalDateTime desde);
}
