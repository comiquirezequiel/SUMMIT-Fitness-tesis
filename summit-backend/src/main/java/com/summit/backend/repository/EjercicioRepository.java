package com.summit.backend.repository;

import com.summit.backend.model.Ejercicio;
import com.summit.backend.model.GrupoMuscular;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EjercicioRepository extends JpaRepository<Ejercicio, Long> {
    List<Ejercicio> findByGrupoMuscular(GrupoMuscular grupoMuscular);
    Optional<Ejercicio> findBySvgTargetId(String svgTargetId);
}
