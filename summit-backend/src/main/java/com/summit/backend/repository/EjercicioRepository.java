package com.summit.backend.repository;

import com.summit.backend.model.Ejercicio;
import com.summit.backend.model.GrupoMuscular;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EjercicioRepository extends JpaRepository<Ejercicio, Long> {
    List<Ejercicio> findByGrupoMuscularOrderByNombre(GrupoMuscular grupoMuscular);
    Optional<Ejercicio> findByNombreIgnoreCase(String nombre);
    boolean existsByNombreIgnoreCase(String nombre);
    boolean existsByNombreIgnoreCaseAndIdEjercicioNot(String nombre, Long idEjercicio);
}
