package com.summit.backend.repository;

import com.summit.backend.model.CierreCaja;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CierreCajaRepository extends JpaRepository<CierreCaja, Long> {

    // El último cierre: donde empieza el turno abierto
    @EntityGraph(attributePaths = "cerradoPor")
    Optional<CierreCaja> findFirstByOrderByHastaDesc();

    @Override
    @EntityGraph(attributePaths = "cerradoPor")
    Page<CierreCaja> findAll(Pageable pageable);
}
