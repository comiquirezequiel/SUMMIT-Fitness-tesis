package com.summit.backend.service;

import com.summit.backend.dto.StaffRequestDTO;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Servicio de gestión de usuarios/socios.
 * CRUD paginado con soft delete (baja lógica).
 */
@Service
@RequiredArgsConstructor
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordService passwordService;

    /**
     * Alta de personal (ADMIN, RECEPCION o PROFESOR).
     * Los socios se crean desde SocioService (el alta la hace recepción).
     */
    public Usuario crearStaff(StaffRequestDTO request) {
        Rol rol;
        try {
            rol = Rol.valueOf(request.getRol().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Rol inválido: " + request.getRol());
        }
        if (rol == Rol.SOCIO) {
            throw new RuntimeException("Los socios se dan de alta desde /api/socios");
        }
        if (usuarioRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("El email ya se encuentra registrado");
        }
        if (usuarioRepository.existsByDni(request.getDni())) {
            throw new RuntimeException("El DNI ya se encuentra registrado");
        }

        Usuario usuario = Usuario.builder()
                .dni(request.getDni())
                .nombreCompleto(request.getNombreCompleto())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .telefono(request.getTelefono())
                .rol(rol)
                .estado(EstadoUsuario.ACTIVO)
                // La contraseña inicial la eligió el admin: al entrar por primera vez tiene que cambiarla
                .debeCambiarPassword(true)
                .build();
        return usuarioRepository.save(usuario);
    }

    /**
     * Restablece la contraseña de otro usuario con una temporal, que el admin le da en persona y hay que
     * cambiar al entrar. La propia se cambia con PUT /api/auth/password.
     *
     * @param emailAdmin quien lo pide
     * @return la contraseña temporal (no se guarda en ningún lado salvo su hash)
     */
    public String restablecerPassword(Long id, String emailAdmin) {
        Usuario usuario = buscarPorId(id);
        if (usuario.getEmail().equalsIgnoreCase(emailAdmin)) {
            throw new RuntimeException("Tu propia contraseña la cambiás desde tu perfil, con la actual");
        }
        return passwordService.restablecerConTemporal(usuario);
    }

    /**
     * Lista todos los usuarios con paginación defensiva.
     */
    public Page<Usuario> listarTodos(Pageable pageable) {
        return usuarioRepository.findAll(pageable);
    }

    /**
     * Lista usuarios filtrados por rol con paginación.
     */
    public java.util.List<Usuario> listarPorRol(Rol rol) {
        return usuarioRepository.findByRol(rol);
    }

    public Usuario buscarPorId(Long id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado con ID: " + id));
    }

    public Usuario buscarPorDni(String dni) {
        return usuarioRepository.findByDni(dni)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado con DNI: " + dni));
    }

    /**
     * Actualiza los datos de un usuario existente.
     */
    public Usuario actualizar(Long id, Usuario datosActualizados) {
        Usuario usuario = buscarPorId(id);
        if (datosActualizados.getNombreCompleto() != null) {
            usuario.setNombreCompleto(datosActualizados.getNombreCompleto());
        }
        if (datosActualizados.getTelefono() != null) {
            usuario.setTelefono(datosActualizados.getTelefono());
        }
        if (datosActualizados.getEmail() != null) {
            usuario.setEmail(datosActualizados.getEmail());
        }
        return usuarioRepository.save(usuario);
    }

    /**
     * Baja lógica: cambia el estado a INACTIVO sin borrar el registro.
     */
    @Transactional
    public void desactivar(Long id) {
        Usuario usuario = buscarPorId(id);
        usuario.setEstado(EstadoUsuario.INACTIVO);
        usuarioRepository.save(usuario);
    }

    /**
     * Reactiva un usuario previamente dado de baja.
     */
    public void activar(Long id) {
        Usuario usuario = buscarPorId(id);
        usuario.setEstado(EstadoUsuario.ACTIVO);
        usuarioRepository.save(usuario);
    }
}
