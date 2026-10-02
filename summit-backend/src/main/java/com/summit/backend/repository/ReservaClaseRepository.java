package com.summit.backend.repository;

import com.summit.backend.model.ReservaClase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ReservaClaseRepository extends JpaRepository<ReservaClase, Long> {
    List<ReservaClase> findBySocioIdUsuario(Long idSocio);
    List<ReservaClase> findByHorarioIdHorarioAndFechaClase(Long idHorario, LocalDate fechaClase);
    long countByHorarioIdHorarioAndFechaClase(Long idHorario, LocalDate fechaClase);
}
