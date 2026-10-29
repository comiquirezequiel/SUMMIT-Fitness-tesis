package com.summit.backend.repository;

import com.summit.backend.model.EstadoTarea;
import com.summit.backend.model.TareaSeguimiento;
import com.summit.backend.model.TipoTarea;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TareaSeguimientoRepository extends JpaRepository<TareaSeguimiento, Long> {

    // Pendientes, de la más urgente a la menos, con el socio en la misma consulta
    @EntityGraph(attributePaths = {"usuario", "creadaPor"})
    List<TareaSeguimiento> findByEstadoOrderByVenceAscIdTareaAsc(EstadoTarea estado);

    // Las ya resueltas, de la última a la primera
    @EntityGraph(attributePaths = {"usuario", "creadaPor", "resueltaPor"})
    List<TareaSeguimiento> findByEstadoInOrderByFechaResolucionDescIdTareaDesc(Collection<EstadoTarea> estados, Pageable pageable);

    // Las automáticas pendientes, para ver si su situación ya se resolvió
    @EntityGraph(attributePaths = "usuario")
    List<TareaSeguimiento> findByEstadoAndTipoNot(EstadoTarea estado, TipoTarea tipo);

    boolean existsByClave(String clave);

    long countByEstado(EstadoTarea estado);

    long countByEstadoAndVenceLessThan(EstadoTarea estado, LocalDate fecha);

    Optional<TareaSeguimiento> findFirstByUsuarioIdUsuarioAndTipoAndEstadoOrderByIdTareaDesc(Long idUsuario, TipoTarea tipo,
                                                                                          EstadoTarea estado);

    // Último contacto (tarea hecha) de cada socio, como filas [idUsuario, fechaResolucion]
    @Query("SELECT t.usuario.idUsuario, MAX(t.fechaResolucion) FROM TareaSeguimiento t "
            + "WHERE t.estado = com.summit.backend.model.EstadoTarea.HECHA GROUP BY t.usuario.idUsuario")
    List<Object[]> ultimoContactoPorSocio();
}
