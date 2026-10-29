package com.summit.backend.repository;

import com.summit.backend.model.EstadoPago;
import com.summit.backend.model.PagoHistorial;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface PagoHistorialRepository extends JpaRepository<PagoHistorial, Long> {

    // Historial de un socio (ficha), con plan y personal en la misma consulta
    @EntityGraph(attributePaths = {"plan", "registradoPor", "verificadoPor"})
    List<PagoHistorial> findByUsuarioIdUsuarioOrderByFechaPagoDesc(Long idUsuario);

    // Trae socio, plan y personal en la misma consulta para el listado de caja
    @Override
    @EntityGraph(attributePaths = {"usuario", "plan", "registradoPor", "verificadoPor"})
    Page<PagoHistorial> findAll(Pageable pageable);

    // Listado de caja filtrado por estado (ej. los "a verificar")
    @EntityGraph(attributePaths = {"usuario", "plan", "registradoPor", "verificadoPor"})
    Page<PagoHistorial> findByEstadoPago(EstadoPago estadoPago, Pageable pageable);

    // Para confirmar un pago "a verificar": bloquea la fila para que dos personas no lo aprueben a la vez
    // (aprobarlo dos veces extendería la membresía dos veces)
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PagoHistorial p WHERE p.idPago = :idPago")
    Optional<PagoHistorial> findParaActualizar(@Param("idPago") Long idPago);

    boolean existsByMpPaymentId(String mpPaymentId);

    // ¿Tiene un cobro reciente a verificar que ya resolvió la matrícula (cobrada o bonificada)? No se le vuelve a cobrar
    boolean existsByUsuarioIdUsuarioAndEstadoPagoAndMatriculaMontoIsNotNullAndFechaPagoAfter(Long idUsuario,
                                                                                            EstadoPago estadoPago,
                                                                                            LocalDateTime desde);

    // ¿Tiene un cobro reciente en ese estado? (ficha de un socio: un cobro a verificar no se vuelve a cobrar)
    boolean existsByUsuarioIdUsuarioAndEstadoPagoAndFechaPagoAfter(Long idUsuario, EstadoPago estadoPago, LocalDateTime desde);

    // Socios con algún cobro reciente en ese estado (lista de socios: los que tienen un cobro a verificar)
    @Query("SELECT DISTINCT p.usuario.idUsuario FROM PagoHistorial p WHERE p.estadoPago = :estado AND p.fechaPago > :desde")
    Set<Long> sociosConPagosDesde(@Param("estado") EstadoPago estado, @Param("desde") LocalDateTime desde);

    // Métricas: cobros aprobados de un rango, como filas [fechaPago, monto, metodoPago, nombrePlan]
    @Query("SELECT p.fechaPago, p.montoAbonado, p.metodoPago, p.plan.nombrePlan FROM PagoHistorial p "
            + "WHERE p.estadoPago = com.summit.backend.model.EstadoPago.APROBADO AND p.fechaPago >= :desde AND p.fechaPago < :hasta")
    List<Object[]> aprobadosEntre(@Param("desde") LocalDateTime desde, @Param("hasta") LocalDateTime hasta);

    // La caja suma solo lo que efectivamente entró: los pagos APROBADOS
    @Query("SELECT COALESCE(SUM(p.montoAbonado), 0) FROM PagoHistorial p "
            + "WHERE p.fechaPago >= :desde AND p.estadoPago = com.summit.backend.model.EstadoPago.APROBADO")
    BigDecimal sumarDesde(@Param("desde") LocalDateTime desde);

    long countByEstadoPagoAndFechaPagoGreaterThanEqual(EstadoPago estadoPago, LocalDateTime desde);

    // Filas [metodoPago, total] de los cobros aprobados desde una fecha
    @Query("SELECT p.metodoPago, COALESCE(SUM(p.montoAbonado), 0) FROM PagoHistorial p "
            + "WHERE p.fechaPago >= :desde AND p.estadoPago = com.summit.backend.model.EstadoPago.APROBADO "
            + "GROUP BY p.metodoPago")
    List<Object[]> sumarPorMetodoDesde(@Param("desde") LocalDateTime desde);

    // Cobros aprobados de un turno de caja, como filas [metodoPago, total, cantidad]
    @Query("SELECT p.metodoPago, COALESCE(SUM(p.montoAbonado), 0), COUNT(p) FROM PagoHistorial p "
            + "WHERE p.estadoPago = com.summit.backend.model.EstadoPago.APROBADO "
            + "AND p.fechaPago >= :desde AND p.fechaPago < :hasta GROUP BY p.metodoPago")
    List<Object[]> aprobadosPorMetodoEntre(@Param("desde") LocalDateTime desde, @Param("hasta") LocalDateTime hasta);

    // Pagos "a verificar": cuántos son y cuánto suman (todavía no cuentan como ingreso)
    long countByEstadoPago(EstadoPago estadoPago);

    @Query("SELECT COALESCE(SUM(p.montoAbonado), 0) FROM PagoHistorial p WHERE p.estadoPago = :estado")
    BigDecimal sumarPorEstado(@Param("estado") EstadoPago estado);
}
