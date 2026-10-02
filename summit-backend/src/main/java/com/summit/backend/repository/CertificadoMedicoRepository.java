package com.summit.backend.repository;

import com.summit.backend.model.CertificadoMedico;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CertificadoMedicoRepository extends JpaRepository<CertificadoMedico, Long> {
    Optional<CertificadoMedico> findFirstByUsuarioIdUsuarioOrderByFechaVencimientoDesc(Long idUsuario);
    List<CertificadoMedico> findByUsuarioIdUsuario(Long idUsuario);
    List<CertificadoMedico> findByEstadoLegalAndFechaVencimientoBefore(com.summit.backend.model.EstadoLegalCertificado estado, java.time.LocalDate date);
}
