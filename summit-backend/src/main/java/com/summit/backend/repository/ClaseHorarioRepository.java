package com.summit.backend.repository;

import com.summit.backend.model.ClaseHorario;
import com.summit.backend.model.DiaSemana;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClaseHorarioRepository extends JpaRepository<ClaseHorario, Long> {
    List<ClaseHorario> findByDiaSemana(DiaSemana diaSemana);
    List<ClaseHorario> findByClaseIdClase(Long idClase);

    // Horarios de clases activas de un día, con la clase y su profesor (agenda y control de superposición)
    @EntityGraph(attributePaths = {"clase", "clase.profesor"})
    List<ClaseHorario> findByDiaSemanaAndClaseActivaTrueOrderByHoraInicio(DiaSemana diaSemana);

    // Horarios de todas las clases activas, con la clase y su profesor (agenda de varios días)
    @EntityGraph(attributePaths = {"clase", "clase.profesor"})
    List<ClaseHorario> findByClaseActivaTrueOrderByHoraInicioAscIdHorarioAsc();
}
