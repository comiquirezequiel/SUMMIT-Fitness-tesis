package com.summit.service;

import com.summit.model.entity.AsistenciaLog;
import com.summit.model.entity.CertificadoMedico;
import com.summit.model.entity.Pago;
import com.summit.model.entity.Usuario;
import com.summit.model.enums.EstadoLegal;
import com.summit.model.enums.ResultadoAcceso;
import com.summit.model.enums.TipoEvento;
import com.summit.repository.AsistenciaLogRepository;
import com.summit.repository.CertificadoMedicoRepository;
import com.summit.repository.PagoRepository;
import com.summit.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class AccesoService {

    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private CertificadoMedicoRepository certificadoRepository;
    @Autowired
    private AsistenciaLogRepository asistenciaLogRepository;
    
    // Inyectamos el repositorio de pagos
    @Autowired
    private PagoRepository pagoRepository;

    @Transactional
    public ResultadoAcceso registrarIntentoDeAcceso(String dniUsuario) {
        // 1. Buscar al usuario
        Optional<Usuario> usuarioOpt = usuarioRepository.findByDni(dniUsuario);
        if (usuarioOpt.isEmpty()) {
            return null; // El Controller devolverá 404
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
            
        } else {
            // 3. BARRERA FINANCIERA: Evaluamos solo si superó la barrera médica
            // Buscamos el último pago del usuario
            Optional<Pago> ultimoPago = pagoRepository.findTopByUsuarioIdOrderByFechaPagoDesc(usuario.getId());
            
            // Asumimos que un pago dura 30 días exactos desde su fecha de cobro
            // Pero también verificamos que el pago haya sido APROBADO (no rechazado ni pendiente)
            // Si el pago fue rechazado, el cliente NO está al día y debe ser bloqueado
            // Verificamos: (1) que exista un pago, (2) que esté APROBADO, (3) que tenga menos de 30 días
            if (ultimoPago.isEmpty() || 
                ultimoPago.get().getEstadoPago() != com.summit.model.enums.EstadoPago.APROBADO ||
                ultimoPago.get().getFechaPago().plusDays(30).isBefore(LocalDateTime.now())) {
                
                // Si alguna condición no se cumple, bloqueamos el acceso por pago
                resultadoFinal = ResultadoAcceso.BLOQUEO_PAGO;
            }
        }

        // 4. Registrar el Log Inmutable (Auditoría)
        AsistenciaLog log = new AsistenciaLog();
        log.setUsuario(usuario);
        log.setFechaHora(LocalDateTime.now());
        log.setTipoEvento(TipoEvento.ENTRADA);
        log.setResultado(resultadoFinal);
        
        asistenciaLogRepository.save(log);

        return resultadoFinal; // Retorna la decisión fáctica del motor
    }
}
