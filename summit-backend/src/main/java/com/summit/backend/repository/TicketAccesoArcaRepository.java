package com.summit.backend.repository;

import com.summit.backend.model.AmbienteArca;
import com.summit.backend.model.TicketAccesoArca;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TicketAccesoArcaRepository extends JpaRepository<TicketAccesoArca, Long> {

    Optional<TicketAccesoArca> findByAmbienteAndHuellaCertificado(AmbienteArca ambiente, String huellaCertificado);
}
