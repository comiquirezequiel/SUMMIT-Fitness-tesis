package com.summit.backend.repository;

import com.summit.backend.model.LogEntrenamiento;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LogEntrenamientoRepository extends JpaRepository<LogEntrenamiento, Long> {

    Optional<LogEntrenamiento> findByRutinaEjercicioIdRutinaEjercicioAndFecha(Long idRutinaEjercicio, LocalDate fecha);

    // Lo registrado de una rutina en una fecha, del más reciente al más viejo
    List<LogEntrenamiento> findByRutinaIdRutinaAndFechaOrderByFechaRegistroDesc(Long idRutina, LocalDate fecha);

    // Último entrenamiento de la rutina antes de una fecha (para saber qué día le toca al socio)
    Optional<LogEntrenamiento> findFirstByRutinaIdRutinaAndFechaBeforeOrderByFechaDescFechaRegistroDesc(Long idRutina, LocalDate fecha);

    // Registros de la última fecha anterior a :fecha en que el socio hizo cada ejercicio ("la vez pasada")
    @Query("""
            SELECT l FROM LogEntrenamiento l
            WHERE l.socio.idUsuario = :idSocio AND l.ejercicio.idEjercicio IN :idsEjercicio
              AND l.fecha = (SELECT MAX(l2.fecha) FROM LogEntrenamiento l2
                             WHERE l2.socio = l.socio AND l2.ejercicio = l.ejercicio AND l2.fecha < :fecha)
            """)
    List<LogEntrenamiento> findUltimosAntesDe(@Param("idSocio") Long idSocio,
                                              @Param("idsEjercicio") Collection<Long> idsEjercicio,
                                              @Param("fecha") LocalDate fecha);

    @EntityGraph(attributePaths = "rutina")
    List<LogEntrenamiento> findBySocioIdUsuarioAndFechaBetweenOrderByFechaDescFechaRegistroDesc(
            Long idSocio, LocalDate desde, LocalDate hasta);

    @EntityGraph(attributePaths = {"ejercicio", "registradoPor", "rutinaEjercicio"})
    List<LogEntrenamiento> findBySocioIdUsuarioAndFecha(Long idSocio, LocalDate fecha);

    List<LogEntrenamiento> findBySocioIdUsuarioAndEjercicioIdEjercicioOrderByFechaAscFechaRegistroAsc(
            Long idSocio, Long idEjercicio);

    // Todo lo que anotó un socio, del más viejo al más nuevo, con el ejercicio (récords personales)
    @EntityGraph(attributePaths = "ejercicio")
    List<LogEntrenamiento> findBySocioIdUsuarioOrderByFechaAscFechaRegistroAsc(Long idSocio);

    // Filas [idEjercicio, nombre, grupoMuscular, cantidad de registros] de los ejercicios que el socio entrenó
    @Query("""
            SELECT e.idEjercicio, e.nombre, e.grupoMuscular, COUNT(l)
            FROM LogEntrenamiento l JOIN l.ejercicio e
            WHERE l.socio.idUsuario = :idSocio
            GROUP BY e.idEjercicio, e.nombre, e.grupoMuscular
            ORDER BY e.nombre
            """)
    List<Object[]> contarPorEjercicio(@Param("idSocio") Long idSocio);

    // Filas [idSocio, nombreSocio, idRutina, nombreRutina, día, registros, RPE promedio,
    //        ejercicios de ese día en la rutina, última carga] por socio y día entrenado en la fecha (una consulta)
    @Query("""
            SELECT s.idUsuario, s.nombreCompleto, r.idRutina, r.nombre, l.diaNumero, COUNT(l), AVG(l.rpe),
                   (SELECT COUNT(re) FROM RutinaEjercicio re
                    WHERE re.rutina = r AND COALESCE(re.diaNumero, 1) = l.diaNumero),
                   MAX(l.fechaRegistro)
            FROM LogEntrenamiento l JOIN l.socio s JOIN l.rutina r
            WHERE l.fecha = :fecha
            GROUP BY s.idUsuario, s.nombreCompleto, r.idRutina, r.nombre, l.diaNumero
            ORDER BY MAX(l.fechaRegistro) DESC
            """)
    List<Object[]> resumenPorSocioDelDia(@Param("fecha") LocalDate fecha);

    // Al quitar un ejercicio de la rutina, sus registros quedan sin esa referencia (el historial no se pierde)
    @Modifying
    @Query("UPDATE LogEntrenamiento l SET l.rutinaEjercicio = null WHERE l.rutinaEjercicio.idRutinaEjercicio = :idRutinaEjercicio")
    int desvincularEjercicioDeRutina(@Param("idRutinaEjercicio") Long idRutinaEjercicio);
}
