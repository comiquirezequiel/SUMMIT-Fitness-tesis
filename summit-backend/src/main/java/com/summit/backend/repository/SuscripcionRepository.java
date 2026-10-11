package com.summit.backend.repository;

import com.summit.backend.model.Suscripcion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SuscripcionRepository extends JpaRepository<Suscripcion, Long> {
    Optional<Suscripcion> findFirstByUsuarioIdUsuarioAndActivaTrueOrderByFechaVencimientoDesc(Long idUsuario);
    List<Suscripcion> findByUsuarioIdUsuario(Long idUsuario);
    List<Suscripcion> findByFechaVencimientoBeforeAndActivaTrue(LocalDate fecha);
    long countByActivaTrueAndFechaVencimientoBetween(LocalDate desde, LocalDate hasta);

    // Métricas: cada membresía como fila [idUsuario, nombrePlan, fechaInicio, fechaVencimiento]
    // (socios activos en una fecha, bajas y socios por plan)
    @Query("SELECT s.usuario.idUsuario, s.plan.nombrePlan, s.fechaInicio, s.fechaVencimiento FROM Suscripcion s")
    List<Object[]> vencimientosConPlan();
}
