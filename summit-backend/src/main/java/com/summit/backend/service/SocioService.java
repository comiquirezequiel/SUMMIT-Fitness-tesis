package com.summit.backend.service;

import com.summit.backend.dto.SocioRequestDTO;
import com.summit.backend.dto.SocioResponseDTO;
import com.summit.backend.dto.SocioUpdateRequestDTO;
import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.model.ConfiguracionAcceso;
import com.summit.backend.model.Congelamiento;
import com.summit.backend.model.Descuento;
import com.summit.backend.model.EstadoPago;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.PerfilSocio;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Suscripcion;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.PagoHistorialRepository;
import com.summit.backend.repository.PerfilSocioRepository;
import com.summit.backend.repository.SuscripcionRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
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
    private final PasswordService passwordService;
    private final DescuentoService descuentoService;
    private final CongelamientoService congelamientoService;
    private final PagoHistorialRepository pagoHistorialRepository;

    public List<SocioResponseDTO> listarTodos() {
        ConfiguracionAcceso config = configService.obtenerConfiguracionGlobal();
        Map<Long, LocalDate> congelados = congelamientoService.congeladosHoy();
        Set<Long> conCobroAVerificar = pagoHistorialRepository.sociosConPagosDesde(EstadoPago.PENDIENTE, desdeCobrosAVerificar());
        return usuarioRepository.findByRol(Rol.SOCIO).stream()
                .map(usuario -> mapToDTO(usuario, config, congelados.get(usuario.getIdUsuario()),
                        conCobroAVerificar.contains(usuario.getIdUsuario())))
                .collect(Collectors.toList());
    }

    public SocioResponseDTO buscarPorId(Long id) {
        return mapToDTO(buscarSocio(id), configService.obtenerConfiguracionGlobal());
    }

    @Transactional
    public SocioResponseDTO crearSocio(SocioRequestDTO request) {
        if (usuarioRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("El email ya se encuentra registrado");
        }
        if (usuarioRepository.existsByDni(request.dni())) {
            throw new IllegalArgumentException("El DNI ya se encuentra registrado");
        }

        Usuario nuevoSocio = Usuario.builder()
                .dni(request.dni())
                .nombreCompleto(request.nombreCompleto().trim())
                .email(request.email().trim())
                // Los socios no entran al sistema: la columna es obligatoria, así que lleva una al azar que nadie conoce
                .password(passwordEncoder.encode(passwordService.alAzar()))
                .telefono(textoOpcional(request.telefono()))
                .rol(Rol.SOCIO)
                .estado(EstadoUsuario.ACTIVO)
                .build();
        nuevoSocio = usuarioRepository.save(nuevoSocio);

        perfilSocioRepository.save(PerfilSocio.builder()
                .usuario(nuevoSocio)
                .fechaNacimiento(request.fechaNacimiento())
                .genero(textoOpcional(request.genero()))
                .domicilio(textoOpcional(request.domicilio()))
                .ciudad(textoOpcional(request.ciudad()))
                .objetivo(textoOpcional(request.objetivo()))
                .observaciones(textoOpcional(request.observaciones()))
                .descuento(request.idDescuento() != null ? descuentoService.activo(request.idDescuento()) : null)
                .build());

        return mapToDTO(nuevoSocio, configService.obtenerConfiguracionGlobal());
    }

    @Transactional
    public SocioResponseDTO actualizarSocio(Long id, SocioUpdateRequestDTO request) {
        Usuario socio = buscarSocio(id);

        // Verificar si se cambia el email, que no exista ya
        if (!socio.getEmail().equals(request.email()) && usuarioRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("El nuevo email ya se encuentra registrado por otro usuario");
        }

        socio.setNombreCompleto(request.nombreCompleto().trim());
        socio.setEmail(request.email().trim());
        socio.setTelefono(textoOpcional(request.telefono()));
        socio = usuarioRepository.save(socio);

        // Los socios creados antes de existir el perfil no lo tienen: se crea al editar
        Usuario usuario = socio;
        PerfilSocio perfil = perfilSocioRepository.findByUsuarioIdUsuario(id)
                .orElseGet(() -> PerfilSocio.builder().usuario(usuario).build());
        perfil.setFechaNacimiento(request.fechaNacimiento());
        perfil.setGenero(textoOpcional(request.genero()));
        perfil.setDomicilio(textoOpcional(request.domicilio()));
        perfil.setCiudad(textoOpcional(request.ciudad()));
        perfil.setObjetivo(textoOpcional(request.objetivo()));
        perfil.setObservaciones(textoOpcional(request.observaciones()));
        perfil.setDescuento(descuentoElegido(request.idDescuento(), perfil.getDescuento()));
        perfilSocioRepository.save(perfil);

        return mapToDTO(socio, configService.obtenerConfiguracionGlobal());
    }

    // Se puede dejar el descuento que ya tenía aunque después se haya desactivado; para elegir otro, tiene que estar activo
    private Descuento descuentoElegido(Long idDescuento, Descuento actual) {
        if (idDescuento == null) {
            return null;
        }
        if (actual != null && actual.getIdDescuento().equals(idDescuento)) {
            return actual;
        }
        return descuentoService.activo(idDescuento);
    }

    /**
     * Baja lógica del socio (pasa a CANCELADO).
     */
    @Transactional
    public void cancelarSocio(Long id) {
        Usuario socio = buscarSocio(id);
        socio.setEstado(EstadoUsuario.CANCELADO);
        usuarioRepository.save(socio);
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
                .orElseThrow(() -> new NoSuchElementException("Socio no encontrado con ID: " + id));
    }

    private static String textoOpcional(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    // Desde cuándo un cobro a verificar sigue en curso (ver PagoService.DIAS_COBRO_A_VERIFICAR)
    private static LocalDateTime desdeCobrosAVerificar() {
        return LocalDateTime.now().minusDays(PagoService.DIAS_COBRO_A_VERIFICAR);
    }

    private SocioResponseDTO mapToDTO(Usuario usuario, ConfiguracionAcceso config) {
        LocalDate congeladaHasta = congelamientoService.vigente(usuario.getIdUsuario(), LocalDate.now())
                .map(Congelamiento::getHasta)
                .orElse(null);
        boolean cobroAVerificar = pagoHistorialRepository.existsByUsuarioIdUsuarioAndEstadoPagoAndFechaPagoAfter(
                usuario.getIdUsuario(), EstadoPago.PENDIENTE, desdeCobrosAVerificar());
        return mapToDTO(usuario, config, congeladaHasta, cobroAVerificar);
    }

    private SocioResponseDTO mapToDTO(Usuario usuario, ConfiguracionAcceso config, LocalDate congeladaHasta,
                                      boolean cobroAVerificar) {
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
                .aptoMedicoVigente(certificadoMedicoService.esVigente(certificado, config))
                .vencimientoApto(certificado.map(CertificadoMedico::getFechaVencimiento).orElse(null))
                .planActual(sub != null ? sub.getPlan().getNombrePlan() : "Sin Plan")
                .idPlanActual(sub != null ? sub.getPlan().getIdPlan() : null)
                .vencimientoMembresia(sub != null ? sub.getFechaVencimiento() : null)
                .membresiaAlDia(membresiaAlDia)
                .cobroAVerificar(cobroAVerificar)
                .congeladaHasta(congeladaHasta)
                .idDescuentoHabitual(perfil != null && perfil.getDescuento() != null ? perfil.getDescuento().getIdDescuento() : null)
                .descuentoHabitual(perfil != null && perfil.getDescuento() != null ? perfil.getDescuento().getNombre() : null)
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
