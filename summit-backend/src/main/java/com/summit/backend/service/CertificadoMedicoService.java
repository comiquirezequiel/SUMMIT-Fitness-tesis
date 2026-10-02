package com.summit.backend.service;

import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.model.EstadoLegalCertificado;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.CertificadoMedicoRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

/**
 * Motor de validación de Apto Médico (Ley 5397).
 * Gestiona el registro y verificación estricta de la caducidad (365 días).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CertificadoMedicoService {

    private final CertificadoMedicoRepository certificadoRepository;
    private final UsuarioRepository usuarioRepository;
    private final ConfiguracionAccesoService configService;

    /**
     * Valida si el apto médico de un socio está vigente considerando las reglas de negocio globales.
     */
    public boolean isAptoMedicoVigente(Long idUsuario) {
        // Consultar configuración global
        com.summit.backend.model.ConfiguracionAcceso config = configService.obtenerConfiguracionGlobal();

        // Si comercialmente el gimnasio decide no requerir certificado, pasamos directamente
        if (!config.isRequerirCertificadoMedico()) {
            return true;
        }

        Optional<CertificadoMedico> certOpt = certificadoRepository
                .findFirstByUsuarioIdUsuarioOrderByFechaVencimientoDesc(idUsuario);

        if (certOpt.isEmpty()) {
            return false;
        }

        CertificadoMedico cert = certOpt.get();

        // Calcular fecha límite de acceso sumando los días de gracia permitidos
        LocalDate fechaLimiteConGracia = cert.getFechaVencimiento().plusDays(config.getDiasGraciaCertificado());

        // Validación flexible: ¿La fecha de hoy es anterior o igual a la fecha de vencimiento + gracia?
        return !LocalDate.now().isAfter(fechaLimiteConGracia);
    }

    public Optional<CertificadoMedico> obtenerCertificadoActual(Long idUsuario) {
        return certificadoRepository.findFirstByUsuarioIdUsuarioOrderByFechaVencimientoDesc(idUsuario);
    }

    /**
     * Registra un nuevo certificado médico para un socio.
     * La fecha de vencimiento se calcula automáticamente a 365 días desde la emisión.
     */
    public CertificadoMedico registrarCertificado(Long idUsuario, String archivoUrl, LocalDate fechaEmision, String observacionesPatologias) {
        Usuario socio = usuarioRepository.findById(idUsuario)
                .orElseThrow(() -> new RuntimeException("Socio no encontrado"));

        // No permitir emitir certificados en el futuro
        if (fechaEmision.isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("La fecha de emisión no puede ser futura");
        }

        // Si el certificado ya tiene más de 365 días en el momento de la carga, se rechaza
        LocalDate fechaVencimiento = fechaEmision.plusDays(365);
        if (fechaVencimiento.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("El certificado ya se encuentra vencido (> 365 días)");
        }

        CertificadoMedico certificado = CertificadoMedico.builder()
                .usuario(socio)
                .archivoUrl(archivoUrl)
                .fechaEmision(fechaEmision)
                .fechaVencimiento(fechaVencimiento)
                .estadoLegal(EstadoLegalCertificado.VIGENTE)
                .observacionesPatologias(observacionesPatologias)
                .build();

        return certificadoRepository.save(certificado);
    }

    /**
     * Cron Job: Ejecuta todos los días a las 00:00.
     * Revoca automáticamente el acceso (marca como VENCIDO) a los certificados caducados.
     */
    @Scheduled(cron = "0 0 0 * * ?")
    public void procesarCertificadosVencidos() {
        log.info("Ejecutando proceso por lotes: Revocación de certificados médicos vencidos (Ley 5397)");
        
        List<CertificadoMedico> vencidos = certificadoRepository
                .findByEstadoLegalAndFechaVencimientoBefore(EstadoLegalCertificado.VIGENTE, LocalDate.now());

        if (vencidos.isEmpty()) {
            log.info("No se encontraron certificados vencidos el día de hoy.");
            return;
        }

        for (CertificadoMedico cert : vencidos) {
            cert.setEstadoLegal(EstadoLegalCertificado.VENCIDO);
            log.info("Revocando certificado del usuario ID: {}", cert.getUsuario().getIdUsuario());
        }

        certificadoRepository.saveAll(vencidos);
        log.info("Se revocaron {} certificados médicos.", vencidos.size());
    }
}
