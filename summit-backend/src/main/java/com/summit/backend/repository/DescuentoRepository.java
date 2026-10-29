package com.summit.backend.repository;

import com.summit.backend.model.Descuento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DescuentoRepository extends JpaRepository<Descuento, Long> {

    // Catálogo: primero los activos, por nombre
    List<Descuento> findAllByOrderByActivoDescNombreAsc();

    List<Descuento> findByActivoTrueOrderByNombreAsc();

    boolean existsByNombreIgnoreCase(String nombre);

    boolean existsByNombreIgnoreCaseAndIdDescuentoNot(String nombre, Long idDescuento);
}
