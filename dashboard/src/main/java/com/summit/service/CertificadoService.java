package com.summit.service;

import com.summit.model.entity.CertificadoMedico;
import com.summit.model.entity.Usuario;
import com.summit.model.enums.EstadoLegal;
import com.summit.model.enums.EstadoUsuario;
import com.summit.repository.CertificadoMedicoRepository;
import com.summit.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

@Service
public class CertificadoService {

    @Autowired
    private CertificadoMedicoRepository certificadoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Transactional
    public String simularCargaYAuditoria(String dni) {
        Optional<Usuario> usuarioOpt = usuarioRepository.findByDni(dni);
        
        if (usuarioOpt.isEmpty()) {
            throw new RuntimeException("Usuario no encontrado");
        }

        Usuario usuario = usuarioOpt.get();

        // Creamos el documento ficticio
        CertificadoMedico certificado = new CertificadoMedico();
        certificado.setUsuario(usuario);
        certificado.setArchivoUrl("/storage/mock-certificado-" + dni + ".pdf"); // Ruta simulada
        certificado.setFechaEmision(LocalDate.now());
        
        // Regla de Negocio Crítica: 365 días exactos de validez
        certificado.setFechaVencimiento(LocalDate.now().plusDays(365));
        
        // Acá está la puerta abierta para la IA. 
        // Hoy lo forzamos a VIGENTE para que el molinete abra. 
        // En el futuro, Ollama gestionará esta asignación.
        certificado.setEstadoLegal(EstadoLegal.VIGENTE); 

        certificadoRepository.save(certificado);
        
        if (usuario.getEstado() == EstadoUsuario.PENDIENTE) {
            usuario.setEstado(EstadoUsuario.ACTIVO); usuarioRepository.save(usuario); }

        return "Certificado VIGENTE hasta " + certificado.getFechaVencimiento().toString();
    }
}