package com.summit.service;

import com.summit.model.entity.AsistenciaLog;
import com.summit.model.entity.CertificadoMedico;
import com.summit.model.entity.Usuario;
import com.summit.model.enums.EstadoLegal;
import com.summit.model.enums.ResultadoAcceso;
import com.summit.model.enums.TipoEvento;
import com.summit.repository.AsistenciaLogRepository;
import com.summit.repository.CertificadoMedicoRepository;
import com.summit.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

@Service
public class AccesoService {

    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private CertificadoMedicoRepository certificadoRepository;
    @Autowired
    private AsistenciaLogRepository asistenciaLogRepository;

    @Transactional
    public ResultadoAcceso registrarIntentoDeAcceso(String dniUsuario) {
        // 1. Buscar al usuario
        Optional<Usuario> usuarioOpt = usuarioRepository.findByDni(dniUsuario);
        if (usuarioOpt.isEmpty()) {
            return null; // O lanzar una excepción de "Usuario no encontrado"
        }
        Usuario usuario = usuarioOpt.get();

        ResultadoAcceso resultadoFinal = ResultadoAcceso.ACCESO_PERMITIDO;

        // 2. BARRERA LEGAL: Validar Certificado Médico (RF-02)
        Optional<CertificadoMedico> ultimoCertificado = 
            certificadoRepository.findTopByUsuarioIdOrderByFechaEmisionDesc(usuario.getId());

        if (ultimoCertificado.isEmpty() || 
            ultimoCertificado.get().getEstadoLegal() != EstadoLegal.VIGENTE ||
            ultimoCertificado.get().getFechaVencimiento().isBefore(LocalDate.now())) {
            
            resultadoFinal = ResultadoAcceso.BLOQUEO_MEDICO;
        }

        // 3. Registrar el Log Inmutable (Auditoría)
        AsistenciaLog log = new AsistenciaLog();
        log.setUsuario(usuario);
        log.setTipoEvento(TipoEvento.ENTRADA);
        log.setResultado(resultadoFinal);
        
        asistenciaLogRepository.save(log);

        return resultadoFinal; // Retorna si el molinete debe abrirse o sonar la chicharra
    }
}
