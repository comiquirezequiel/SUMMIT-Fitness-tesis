package com.summit.backend.service;

import com.summit.backend.dto.SocioRequestDTO;
import com.summit.backend.dto.SocioResponseDTO;
import com.summit.backend.dto.SocioUpdateRequestDTO;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Servicio exclusivo para la gestión de Socios.
 * Coordina la entidad Usuario (Rol.SOCIO) con el motor de Apto Médico.
 */
@Service
@RequiredArgsConstructor
public class SocioService {

    private final UsuarioRepository usuarioRepository;
    private final CertificadoMedicoService certificadoMedicoService;
    private final com.summit.backend.repository.SuscripcionRepository suscripcionRepository;
    private final ConfiguracionAccesoService configService;
    private final PasswordEncoder passwordEncoder;

    public List<SocioResponseDTO> listarTodos() {
        return usuarioRepository.findByRol(Rol.SOCIO).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    public SocioResponseDTO buscarPorId(Long id) {
        Usuario socio = usuarioRepository.findById(id)
                .filter(u -> u.getRol() == Rol.SOCIO)
                .orElseThrow(() -> new RuntimeException("Socio no encontrado con ID: " + id));
        
        return mapToDTO(socio);
    }

    public SocioResponseDTO crearSocio(SocioRequestDTO request) {
        if (usuarioRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("El email ya se encuentra registrado");
        }
        if (usuarioRepository.existsByDni(request.getDni())) {
            throw new RuntimeException("El DNI ya se encuentra registrado");
        }

        Usuario nuevoSocio = Usuario.builder()
                .dni(request.getDni())
                .nombreCompleto(request.getNombreCompleto())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .telefono(request.getTelefono())
                .rol(Rol.SOCIO)
                .estado(EstadoUsuario.ACTIVO)
                .build();

        nuevoSocio = usuarioRepository.save(nuevoSocio);
        return mapToDTO(nuevoSocio);
    }

    public SocioResponseDTO actualizarSocio(Long id, SocioUpdateRequestDTO request) {
        Usuario socio = usuarioRepository.findById(id)
                .filter(u -> u.getRol() == Rol.SOCIO)
                .orElseThrow(() -> new RuntimeException("Socio no encontrado con ID: " + id));

        // Verificar si se cambia el email, que no exista ya
        if (!socio.getEmail().equals(request.getEmail()) && usuarioRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("El nuevo email ya se encuentra registrado por otro usuario");
        }

        socio.setNombreCompleto(request.getNombreCompleto());
        socio.setEmail(request.getEmail());
        socio.setTelefono(request.getTelefono());

        socio = usuarioRepository.save(socio);
        return mapToDTO(socio);
    }

    /**
     * Baja lógica del socio (pasa a CANCELADO).
     */
    public void cancelarSocio(Long id) {
        Usuario socio = usuarioRepository.findById(id)
                .filter(u -> u.getRol() == Rol.SOCIO)
                .orElseThrow(() -> new RuntimeException("Socio no encontrado con ID: " + id));

        socio.setEstado(EstadoUsuario.CANCELADO);
        usuarioRepository.save(socio);
    }

    private SocioResponseDTO mapToDTO(Usuario usuario) {
        boolean aptoMedicoVigente = certificadoMedicoService.isAptoMedicoVigente(usuario.getIdUsuario());

        com.summit.backend.model.ConfiguracionAcceso config = configService.obtenerConfiguracionGlobal();
        
        com.summit.backend.model.Suscripcion sub = suscripcionRepository
                .findFirstByUsuarioIdUsuarioAndActivaTrueOrderByFechaVencimientoDesc(usuario.getIdUsuario())
                .orElse(null);

        String planActual = sub != null ? sub.getPlan().getNombrePlan() : "Sin Plan";
        java.time.LocalDate vencimiento = sub != null ? sub.getFechaVencimiento() : null;
        
        boolean membresiaAlDia = false;
        if (!config.isRequerirMembresiaActiva()) {
            membresiaAlDia = true;
        } else if (sub != null) {
            java.time.LocalDate limite = sub.getFechaVencimiento().plusDays(config.getDiasGraciaMembresia());
            membresiaAlDia = !java.time.LocalDate.now().isAfter(limite);
        }

        return SocioResponseDTO.builder()
                .idSocio(usuario.getIdUsuario())
                .dni(usuario.getDni())
                .nombreCompleto(usuario.getNombreCompleto())
                .email(usuario.getEmail())
                .telefono(usuario.getTelefono())
                .estado(usuario.getEstado())
                .fechaCreacion(usuario.getFechaCreacion())
                .aptoMedicoVigente(aptoMedicoVigente)
                .planActual(planActual)
                .vencimientoMembresia(vencimiento)
                .membresiaAlDia(membresiaAlDia)
                .build();
    }
}
