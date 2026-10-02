package com.summit.backend.repository;

import com.summit.backend.model.Ejercicio;
import com.summit.backend.model.GrupoMuscular;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EjercicioRepository extends JpaRepository<Ejercicio, Long> {
    List<Ejercicio> findByGrupoMuscularOrderByNombre(GrupoMuscular grupoMuscular);
    // Varios ejercicios trabajan la misma zona del modelo 2D
    List<Ejercicio> findBySvgTargetId(String svgTargetId);
    boolean existsByNombreIgnoreCase(String nombre);
    boolean existsByNombreIgnoreCaseAndIdEjercicioNot(String nombre, Long idEjercicio);
}
