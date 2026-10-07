package com.summit.backend.service;

import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.model.ConfiguracionAcceso;
import com.summit.backend.model.EstadoLegalCertificado;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.CertificadoMedicoRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
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
    private final ArchivoService archivoService;

    /**
     * Valida si el apto médico de un socio está vigente considerando las reglas de negocio globales.
     */
    public boolean isAptoMedicoVigente(Long idUsuario) {
        return esVigente(obtenerCertificadoActual(idUsuario), configService.obtenerConfiguracionGlobal());
    }

    /**
     * Vigente = existe, no fue rechazado y hoy no pasó el vencimiento + días de gracia.
     * Si el gimnasio decide no exigir certificado, siempre es vigente.
     */
    public boolean esVigente(Optional<CertificadoMedico> certificado, ConfiguracionAcceso config) {
        if (!config.isRequerirCertificadoMedico()) {
            return true;
        }
        if (certificado.isEmpty() || certificado.get().getEstadoLegal() == EstadoLegalCertificado.RECHAZADO) {
            return false;
        }
        LocalDate fechaLimiteConGracia = certificado.get().getFechaVencimiento()
                .plusDays(config.getDiasGraciaCertificado());
        return !LocalDate.now().isAfter(fechaLimiteConGracia);
    }

    public Optional<CertificadoMedico> obtenerCertificadoActual(Long idUsuario) {
        return certificadoRepository.findFirstByUsuarioIdUsuarioOrderByFechaVencimientoDesc(idUsuario);
    }

    public List<CertificadoMedico> listarPorSocio(Long idUsuario) {
        return certificadoRepository.findByUsuarioIdUsuarioOrderByFechaEmisionDesc(idUsuario);
    }

    /**
     * Certificado de un socio (valida que el certificado pertenezca a ese socio).
     */
    public CertificadoMedico buscarDelSocio(Long idSocio, Long idCertificado) {
        return certificadoRepository.findById(idCertificado)
                .filter(c -> c.getUsuario().getIdUsuario().equals(idSocio))
                .orElseThrow(() -> new RuntimeException("Certificado no encontrado"));
    }

    /**
     * Registra un nuevo certificado médico (PDF o imagen) para un socio.
     * La fecha de vencimiento se calcula automáticamente a 365 días desde la emisión.
     */
    public CertificadoMedico registrarCertificado(Long idUsuario, MultipartFile archivo, LocalDate fechaEmision,
                                                  String observacionesPatologias, String resumenIa) {
        Usuario socio = usuarioRepository.findById(idUsuario)
                .filter(u -> u.getRol() == Rol.SOCIO)
                .orElseThrow(() -> new RuntimeException("Socio no encontrado"));

        // Primero se validan las fechas y los textos, así un certificado inválido no deja archivos guardados
        LocalDate fechaVencimiento = calcularVencimiento(fechaEmision);
        String patologias = textoOpcional(observacionesPatologias, 500, "Las patologías");
        String resumen = textoOpcional(resumenIa, 1000, "El resumen");
        String rutaArchivo = archivoService.guardar(archivo, "certificados", "socio-" + idUsuario);

        try {
            CertificadoMedico certificado = CertificadoMedico.builder()
                    .usuario(socio)
                    .archivoUrl(rutaArchivo)
                    .fechaEmision(fechaEmision)
                    .fechaVencimiento(fechaVencimiento)
                    .estadoLegal(EstadoLegalCertificado.VIGENTE)
                    .observacionesPatologias(patologias)
                    .resumenIa(resumen)
                    .build();
            return certificadoRepository.save(certificado);
        } catch (RuntimeException e) {
            archivoService.eliminar(rutaArchivo);
            throw e;
        }
    }

    /**
     * Corrige las patologías y el resumen de un certificado (por ejemplo, al confirmar lo que propuso
     * el asistente de IA). Reemplaza los dos campos: vacío los borra.
     *
     * <p>Este es el ÚNICO punto donde lo que leyó la IA llega a la base de datos, y solo se llama cuando una
     * persona toca "Guardar en la ficha" (supervisión humana). @Transactional: la lectura y el guardado ocurren
     * en una misma transacción. buscarDelSocio(...) garantiza que el certificado sea de ese socio.</p>
     */
    @Transactional
    public CertificadoMedico actualizarObservaciones(Long idSocio, Long idCertificado,
                                                     String observacionesPatologias, String resumenIa) {
        CertificadoMedico certificado = buscarDelSocio(idSocio, idCertificado);
        certificado.setObservacionesPatologias(textoOpcional(observacionesPatologias, 500, "Las patologías"));
        certificado.setResumenIa(textoOpcional(resumenIa, 1000, "El resumen"));
        return certificadoRepository.save(certificado);
    }

    // Texto opcional: vacío → null (no se guardan cadenas vacías); más largo que la columna → error claro (400)
    // en lugar de que la base de datos falle con un error técnico.
    private static String textoOpcional(String texto, int maximo, String campo) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        String limpio = texto.trim();
        if (limpio.length() > maximo) {
            throw new IllegalArgumentException(campo + " no pueden superar los " + maximo + " caracteres");
        }
        return limpio;
    }

    private LocalDate calcularVencimiento(LocalDate fechaEmision) {
        if (fechaEmision == null) {
            throw new IllegalArgumentException("La fecha de emisión es obligatoria");
        }
        // No permitir emitir certificados en el futuro
        if (fechaEmision.isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("La fecha de emisión no puede ser futura");
        }
        // Si el certificado ya tiene más de 365 días en el momento de la carga, se rechaza
        LocalDate fechaVencimiento = fechaEmision.plusDays(365);
        if (fechaVencimiento.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("El certificado ya se encuentra vencido (> 365 días)");
        }
        return fechaVencimiento;
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
