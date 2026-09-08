package com.summit.repository;

import com.summit.model.entity.CertificadoMedico;
import com.summit.model.enums.EstadoLegal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CertificadoMedicoRepository extends JpaRepository<CertificadoMedico, Long> {

    // 1. Para la BARRERA LEGAL en el molinete (RF-02): 
    // Busca el último certificado que presentó un socio específico.
    Optional<CertificadoMedico> findTopByUsuarioIdOrderByFechaEmisionDesc(Long usuarioId);

    // 2. Para la IA OLLAMA: 
    // Busca todos los certificados en un estado específico (ej. "PENDIENTE_AUDITORIA" si lo agregaras luego)
    // o para buscar todos los vigentes y extraer posibles patologías.
    List<CertificadoMedico> findByEstadoLegal(EstadoLegal estado);
}