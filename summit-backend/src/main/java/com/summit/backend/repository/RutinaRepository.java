package com.summit.backend.repository;

import com.summit.backend.model.Rutina;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RutinaRepository extends JpaRepository<Rutina, Long> {
    List<Rutina> findBySocioIdUsuarioAndActivaTrue(Long idSocio);
    Optional<Rutina> findFirstBySocioIdUsuarioAndActivaTrueOrderByFechaCreacionDesc(Long idSocio);
}
