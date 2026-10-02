package com.summit.backend.repository;

import com.summit.backend.model.Rutina;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
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

    // Filas [idRutina, nombre, objetivo, idSocio, nombreSocio, idProfesor, nombreProfesor, fechaCreacion,
    //        días (el mayor día con ejercicios), cantidad de ejercicios, último entrenamiento del socio]
    // de las rutinas activas, en una sola consulta (sin traer los ejercicios ni consultar socio por socio)
    @Query("""
            SELECT r.idRutina, r.nombre, r.objetivo, s.idUsuario, s.nombreCompleto, p.idUsuario, p.nombreCompleto,
                   r.fechaCreacion,
                   (SELECT MAX(COALESCE(re.diaNumero, 1)) FROM RutinaEjercicio re WHERE re.rutina = r),
                   (SELECT COUNT(re2) FROM RutinaEjercicio re2 WHERE re2.rutina = r),
                   (SELECT MAX(l.fecha) FROM LogEntrenamiento l WHERE l.socio = s)
            FROM Rutina r JOIN r.socio s LEFT JOIN r.profesor p
            WHERE r.activa = true
            ORDER BY s.nombreCompleto, r.fechaCreacion DESC, r.idRutina DESC
            """)
    List<Object[]> resumenActivas();
}
