package com.summit.backend.repository;

import com.summit.backend.model.PagoHistorial;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PagoHistorialRepository extends JpaRepository<PagoHistorial, Long> {
    List<PagoHistorial> findByUsuarioIdUsuarioOrderByFechaPagoDesc(Long idUsuario);

    // Pagos de un socio con su plan en la misma consulta, del más nuevo al más viejo (portal del socio)
    @EntityGraph(attributePaths = "plan")
    List<PagoHistorial> findByUsuarioIdUsuarioOrderByFechaPagoDescIdPagoDesc(Long idUsuario);

    // Trae socio y plan en la misma consulta para el listado de caja
    @Override
    @EntityGraph(attributePaths = {"usuario", "plan"})
    Page<PagoHistorial> findAll(Pageable pageable);

    @Query("SELECT COALESCE(SUM(p.montoAbonado), 0) FROM PagoHistorial p WHERE p.fechaPago >= :desde")
    BigDecimal sumarDesde(@Param("desde") LocalDateTime desde);

    long countByFechaPagoGreaterThanEqual(LocalDateTime desde);

    // Filas [metodoPago, total] de los cobros desde una fecha
    @Query("SELECT p.metodoPago, COALESCE(SUM(p.montoAbonado), 0) FROM PagoHistorial p WHERE p.fechaPago >= :desde GROUP BY p.metodoPago")
    List<Object[]> sumarPorMetodoDesde(@Param("desde") LocalDateTime desde);
}
