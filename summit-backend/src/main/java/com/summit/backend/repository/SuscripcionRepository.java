package com.summit.backend.repository;

import com.summit.backend.model.Suscripcion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface SuscripcionRepository extends JpaRepository<Suscripcion, Long> {
    Optional<Suscripcion> findFirstByUsuarioIdUsuarioAndActivaTrueOrderByFechaVencimientoDesc(Long idUsuario);
    List<Suscripcion> findByUsuarioIdUsuario(Long idUsuario);
    List<Suscripcion> findByFechaVencimientoBeforeAndActivaTrue(LocalDate fecha);
    long countByActivaTrueAndFechaVencimientoBetween(LocalDate desde, LocalDate hasta);
}
