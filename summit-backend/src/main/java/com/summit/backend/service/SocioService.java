package com.summit.backend.service;

import com.summit.backend.dto.SocioRequestDTO;
import com.summit.backend.dto.SocioResponseDTO;
import com.summit.backend.dto.SocioUpdateRequestDTO;
import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.model.ConfiguracionAcceso;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.PerfilSocio;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Suscripcion;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.PerfilSocioRepository;
import com.summit.backend.repository.SuscripcionRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Servicio exclusivo para la gestión de Socios.
 * Coordina la entidad Usuario (Rol.SOCIO), su perfil y el motor de Apto Médico.
 */
@Service
@RequiredArgsConstructor
public class SocioService {

    private final UsuarioRepository usuarioRepository;
    private final PerfilSocioRepository perfilSocioRepository;
    private final CertificadoMedicoService certificadoMedicoService;
    private final SuscripcionRepository suscripcionRepository;
    private final ConfiguracionAccesoService configService;
    private final PasswordEncoder passwordEncoder;
    private final SesionService sesionService;
    private final PasswordService passwordService;

    public List<SocioResponseDTO> listarTodos() {
        ConfiguracionAcceso config = configService.obtenerConfiguracionGlobal();
        return usuarioRepository.findByRol(Rol.SOCIO).stream()
                .map(usuario -> mapToDTO(usuario, config))
                .collect(Collectors.toList());
    }

    public SocioResponseDTO buscarPorId(Long id) {
        return mapToDTO(buscarSocio(id), configService.obtenerConfiguracionGlobal());
    }

    @Transactional
    public SocioResponseDTO crearSocio(SocioRequestDTO request) {
        if (usuarioRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("El email ya se encuentra registrado");
        }
        if (usuarioRepository.existsByDni(request.getDni())) {
            throw new RuntimeException("El DNI ya se encuentra registrado");
        }

        Usuario nuevoSocio = Usuario.builder()
                .dni(request.getDni())
                .nombreCompleto(request.getNombreCompleto().trim())
                .email(request.getEmail().trim())
                .password(passwordEncoder.encode(request.getPassword()))
                .telefono(textoOpcional(request.getTelefono()))
                .rol(Rol.SOCIO)
                .estado(EstadoUsuario.ACTIVO)
                // La contraseña inicial se la da recepción: al entrar por primera vez a la app tiene que cambiarla
                .debeCambiarPassword(true)
                .build();
        nuevoSocio = usuarioRepository.save(nuevoSocio);

        perfilSocioRepository.save(PerfilSocio.builder()
                .usuario(nuevoSocio)
                .fechaNacimiento(request.getFechaNacimiento())
                .genero(textoOpcional(request.getGenero()))
                .domicilio(textoOpcional(request.getDomicilio()))
                .ciudad(textoOpcional(request.getCiudad()))
                .objetivo(textoOpcional(request.getObjetivo()))
                .observaciones(textoOpcional(request.getObservaciones()))
                .build());

        return mapToDTO(nuevoSocio, configService.obtenerConfiguracionGlobal());
    }

    @Transactional
    public SocioResponseDTO actualizarSocio(Long id, SocioUpdateRequestDTO request) {
        Usuario socio = buscarSocio(id);

        // Verificar si se cambia el email, que no exista ya
        if (!socio.getEmail().equals(request.getEmail()) && usuarioRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("El nuevo email ya se encuentra registrado por otro usuario");
        }

        socio.setNombreCompleto(request.getNombreCompleto().trim());
        socio.setEmail(request.getEmail().trim());
        socio.setTelefono(textoOpcional(request.getTelefono()));
        socio = usuarioRepository.save(socio);

        // Los socios creados antes de existir el perfil no lo tienen: se crea al editar
        Usuario usuario = socio;
        PerfilSocio perfil = perfilSocioRepository.findByUsuarioIdUsuario(id)
                .orElseGet(() -> PerfilSocio.builder().usuario(usuario).build());
        perfil.setFechaNacimiento(request.getFechaNacimiento());
        perfil.setGenero(textoOpcional(request.getGenero()));
        perfil.setDomicilio(textoOpcional(request.getDomicilio()));
        perfil.setCiudad(textoOpcional(request.getCiudad()));
        perfil.setObjetivo(textoOpcional(request.getObjetivo()));
        perfil.setObservaciones(textoOpcional(request.getObservaciones()));
        perfilSocioRepository.save(perfil);

        return mapToDTO(socio, configService.obtenerConfiguracionGlobal());
    }

    /**
     * Baja lógica del socio (pasa a CANCELADO). También cierra su sesión en la app en todos sus celulares:
     * si se lo reactiva, tiene que volver a entrar.
     */
    @Transactional
    public void cancelarSocio(Long id) {
        Usuario socio = buscarSocio(id);
        socio.setEstado(EstadoUsuario.CANCELADO);
        usuarioRepository.save(socio);
        sesionService.cerrarTodas(id);
    }

    /**
     * Le pone al socio una contraseña temporal, que recepción le da en persona y que tiene que cambiar al entrar
     * a la app. Cierra su sesión en todos sus celulares.
     *
     * @return la contraseña temporal (no se guarda en ningún lado salvo su hash)
     */
    public String restablecerPassword(Long id) {
        return passwordService.restablecerConTemporal(buscarSocio(id));
    }

    /**
     * Reactiva a un socio dado de baja.
     */
    public SocioResponseDTO reactivarSocio(Long id) {
        Usuario socio = buscarSocio(id);
        socio.setEstado(EstadoUsuario.ACTIVO);
        return mapToDTO(usuarioRepository.save(socio), configService.obtenerConfiguracionGlobal());
    }

    private Usuario buscarSocio(Long id) {
        return usuarioRepository.findById(id)
                .filter(u -> u.getRol() == Rol.SOCIO)
                .orElseThrow(() -> new RuntimeException("Socio no encontrado con ID: " + id));
    }

    private static String textoOpcional(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    private SocioResponseDTO mapToDTO(Usuario usuario, ConfiguracionAcceso config) {
        Optional<CertificadoMedico> certificado = certificadoMedicoService.obtenerCertificadoActual(usuario.getIdUsuario());
        PerfilSocio perfil = perfilSocioRepository.findByUsuarioIdUsuario(usuario.getIdUsuario()).orElse(null);
        Suscripcion sub = suscripcionRepository
                .findFirstByUsuarioIdUsuarioAndActivaTrueOrderByFechaVencimientoDesc(usuario.getIdUsuario())
                .orElse(null);

        boolean membresiaAlDia = false;
        if (!config.isRequerirMembresiaActiva()) {
            membresiaAlDia = true;
        } else if (sub != null) {
            LocalDate limite = sub.getFechaVencimiento().plusDays(config.getDiasGraciaMembresia());
            membresiaAlDia = !LocalDate.now().isAfter(limite);
        }

        return SocioResponseDTO.builder()
                .idSocio(usuario.getIdUsuario())
                .dni(usuario.getDni())
                .nombreCompleto(usuario.getNombreCompleto())
                .email(usuario.getEmail())
                .telefono(usuario.getTelefono())
                .estado(usuario.getEstado())
                .fechaCreacion(usuario.getFechaCreacion())
                .debeCambiarPassword(usuario.isDebeCambiarPassword())
                .aptoMedicoVigente(certificadoMedicoService.esVigente(certificado, config))
                .vencimientoApto(certificado.map(CertificadoMedico::getFechaVencimiento).orElse(null))
                .planActual(sub != null ? sub.getPlan().getNombrePlan() : "Sin Plan")
                .vencimientoMembresia(sub != null ? sub.getFechaVencimiento() : null)
                .membresiaAlDia(membresiaAlDia)
                .fechaNacimiento(perfil != null ? perfil.getFechaNacimiento() : null)
                .genero(perfil != null ? perfil.getGenero() : null)
                .domicilio(perfil != null ? perfil.getDomicilio() : null)
                .ciudad(perfil != null ? perfil.getCiudad() : null)
                .objetivo(perfil != null ? perfil.getObjetivo() : null)
                .observaciones(perfil != null ? perfil.getObservaciones() : null)
                .fotoVersion(FotoSocioService.version(perfil))
                .build();
    }
}
