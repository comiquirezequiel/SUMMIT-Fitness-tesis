package com.summit.backend.repository;

import com.summit.backend.model.ClaseHorario;
import com.summit.backend.model.DiaSemana;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClaseHorarioRepository extends JpaRepository<ClaseHorario, Long> {
    List<ClaseHorario> findByDiaSemana(DiaSemana diaSemana);
    List<ClaseHorario> findByClaseIdClase(Long idClase);
}
