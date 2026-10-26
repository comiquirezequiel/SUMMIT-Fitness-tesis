package com.summit.backend.repository;

import com.summit.backend.model.Suscripcion;
import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SuscripcionRepository extends JpaRepository<Suscripcion, Long> {
    Optional<Suscripcion> findFirstByUsuarioIdUsuarioAndActivaTrueOrderByFechaVencimientoDesc(Long idUsuario);
    List<Suscripcion> findByUsuarioIdUsuario(Long idUsuario);

    // Para cambiar un vencimiento (cobro, congelamiento): bloquea las membresías activas del socio, de la que vence más
    // tarde a la primera, para que dos operaciones a la vez no pisen el vencimiento de la otra
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Suscripcion s WHERE s.usuario.idUsuario = :idUsuario AND s.activa = true ORDER BY s.fechaVencimiento DESC")
    List<Suscripcion> activasParaActualizar(@Param("idUsuario") Long idUsuario);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Suscripcion s WHERE s.idSuscripcion = :idSuscripcion")
    Optional<Suscripcion> findParaActualizar(@Param("idSuscripcion") Long idSuscripcion);

    // Hasta cuándo tuvo cuota (null si nunca tuvo una membresía): decide si corresponde cobrarle matrícula
    @Query("SELECT MAX(s.fechaVencimiento) FROM Suscripcion s WHERE s.usuario.idUsuario = :idUsuario")
    LocalDate ultimoVencimiento(@Param("idUsuario") Long idUsuario);
    List<Suscripcion> findByFechaVencimientoBeforeAndActivaTrue(LocalDate fecha);
    long countByActivaTrueAndFechaVencimientoBetween(LocalDate desde, LocalDate hasta);

    // Métricas: cada membresía como fila [idUsuario, nombrePlan, fechaInicio, fechaVencimiento]
    // (socios activos en una fecha, bajas y socios por plan)
    @Query("SELECT s.usuario.idUsuario, s.plan.nombrePlan, s.fechaInicio, s.fechaVencimiento FROM Suscripcion s")
    List<Object[]> vencimientosConPlan();
}
