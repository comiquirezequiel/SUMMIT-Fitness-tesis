package com.summit.backend.repository;

import com.summit.backend.model.Rutina;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RutinaRepository extends JpaRepository<Rutina, Long> {
    List<Rutina> findBySocioIdUsuarioAndActivaTrue(Long idSocio);

    // Trae socio, profesor y ejercicios en la misma consulta para armar el DTO (evita N+1)
    @EntityGraph(attributePaths = {"socio", "profesor", "ejercicios", "ejercicios.ejercicio"})
    List<Rutina> findBySocioIdUsuarioAndActivaTrueOrderByFechaCreacionDescIdRutinaDesc(Long idSocio);

    @EntityGraph(attributePaths = {"socio", "profesor", "ejercicios", "ejercicios.ejercicio"})
    Optional<Rutina> findConDetalleByIdRutina(Long idRutina);
}
