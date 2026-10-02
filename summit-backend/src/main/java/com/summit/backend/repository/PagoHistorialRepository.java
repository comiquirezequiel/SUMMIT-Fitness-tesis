package com.summit.backend.repository;

import com.summit.backend.model.PagoHistorial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PagoHistorialRepository extends JpaRepository<PagoHistorial, Long> {
    List<PagoHistorial> findByUsuarioIdUsuarioOrderByFechaPagoDesc(Long idUsuario);
}
