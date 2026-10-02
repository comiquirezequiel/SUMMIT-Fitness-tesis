package com.summit.backend.service;

import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

/**
 * Servicio de gestión de usuarios/socios.
 * CRUD paginado con soft delete (baja lógica).
 */
@Service
@RequiredArgsConstructor
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;

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

    public Usuario buscarPorEmail(String email) {
        return usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado con email: " + email));
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
