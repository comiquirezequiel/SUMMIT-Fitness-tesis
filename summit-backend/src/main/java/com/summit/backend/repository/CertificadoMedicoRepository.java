package com.summit.backend.repository;

import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.model.EstadoLegalCertificado;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CertificadoMedicoRepository extends JpaRepository<CertificadoMedico, Long> {
    Optional<CertificadoMedico> findFirstByUsuarioIdUsuarioOrderByFechaVencimientoDesc(Long idUsuario);

    Optional<CertificadoMedico> findFirstByUsuarioIdUsuarioAndEstadoLegalNotOrderByFechaVencimientoDesc(
            Long idUsuario, EstadoLegalCertificado estadoLegal);

    /**
     * El certificado que rige para el ingreso: el de vencimiento más lejano que no fue rechazado.
     * Así, rechazar un certificado nuevo (ej. ilegible) no le quita el ingreso a quien tiene otro vigente.
     * Si todos fueron rechazados, devuelve el último (y el control de acceso bloquea por "rechazado").
     */
    default Optional<CertificadoMedico> certificadoQueRige(Long idUsuario) {
        return findFirstByUsuarioIdUsuarioAndEstadoLegalNotOrderByFechaVencimientoDesc(idUsuario, EstadoLegalCertificado.RECHAZADO)
                .or(() -> findFirstByUsuarioIdUsuarioOrderByFechaVencimientoDesc(idUsuario));
    }

    List<CertificadoMedico> findByUsuarioIdUsuario(Long idUsuario);

    // Seguimiento: hasta cuándo tiene apto cada socio (sin contar los rechazados), como filas [idUsuario, vencimiento]
    @org.springframework.data.jpa.repository.Query("SELECT c.usuario.idUsuario, MAX(c.fechaVencimiento) FROM CertificadoMedico c "
            + "WHERE c.estadoLegal <> com.summit.backend.model.EstadoLegalCertificado.RECHAZADO GROUP BY c.usuario.idUsuario")
    List<Object[]> vencimientoAptoPorSocio();
    List<CertificadoMedico> findByUsuarioIdUsuarioOrderByFechaEmisionDesc(Long idUsuario);
    List<CertificadoMedico> findByEstadoLegalAndFechaVencimientoBefore(EstadoLegalCertificado estado, java.time.LocalDate date);
}
