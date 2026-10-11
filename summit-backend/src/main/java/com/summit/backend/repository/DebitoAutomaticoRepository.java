package com.summit.backend.repository;

import com.summit.backend.model.DebitoAutomatico;
import com.summit.backend.model.EstadoDebito;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DebitoAutomaticoRepository extends JpaRepository<DebitoAutomatico, Long> {

    @EntityGraph(attributePaths = {"usuario", "plan", "creadoPor"})
    List<DebitoAutomatico> findAllByOrderByFechaAltaDesc();

    @EntityGraph(attributePaths = {"usuario", "plan", "creadoPor"})
    List<DebitoAutomatico> findByEstadoInOrderByFechaAltaDesc(Collection<EstadoDebito> estados);

    // La adhesión más reciente del socio (aunque esté dada de baja), para su ficha y su portal
    @EntityGraph(attributePaths = {"usuario", "plan", "creadoPor"})
    Optional<DebitoAutomatico> findFirstByUsuarioIdUsuarioOrderByFechaAltaDesc(Long idUsuario);

    // La adhesión vigente del socio (esperando autorización, activa o pausada)
    @EntityGraph(attributePaths = {"usuario", "plan"})
    Optional<DebitoAutomatico> findFirstByUsuarioIdUsuarioAndEstadoInOrderByFechaAltaDesc(Long idUsuario,
                                                                                         Collection<EstadoDebito> estados);

    List<DebitoAutomatico> findByPlanIdPlanAndEstadoIn(Long idPlan, Collection<EstadoDebito> estados);

    long countByEstado(EstadoDebito estado);
}
