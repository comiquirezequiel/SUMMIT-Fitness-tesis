package com.summit.backend.repository;

import com.summit.backend.model.Gasto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface GastoRepository extends JpaRepository<Gasto, Long> {

    // Listado con el personal en la misma consulta
    @Override
    @EntityGraph(attributePaths = {"registradoPor", "anuladoPor"})
    Page<Gasto> findAll(Pageable pageable);

    // Gastos no anulados de un turno, como filas [metodoPago, total, cantidad]
    @Query("SELECT g.metodoPago, COALESCE(SUM(g.monto), 0), COUNT(g) FROM Gasto g "
            + "WHERE g.anulado = false AND g.fecha >= :desde AND g.fecha < :hasta GROUP BY g.metodoPago")
    List<Object[]> sumarPorMetodoEntre(@Param("desde") LocalDateTime desde, @Param("hasta") LocalDateTime hasta);

    @Query("SELECT COALESCE(SUM(g.monto), 0) FROM Gasto g WHERE g.anulado = false AND g.fecha >= :desde")
    BigDecimal sumarDesde(@Param("desde") LocalDateTime desde);

    long countByAnuladoFalseAndFechaGreaterThanEqual(LocalDateTime desde);
}
