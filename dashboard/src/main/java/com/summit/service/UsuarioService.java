package com.summit.service;

import com.summit.dto.NuevoSocioDTO;
import com.summit.model.entity.Usuario;
import com.summit.model.enums.EstadoUsuario;
import com.summit.model.enums.Rol;
import com.summit.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class UsuarioService {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Transactional
    public Usuario registrarNuevoSocio(NuevoSocioDTO dto) throws Exception {
        // Validación básica para no duplicar DNIs
        if (usuarioRepository.findByDni(dto.getDni()).isPresent()) {
            throw new Exception("El DNI ya se encuentra registrado en el sistema.");
        }

        Usuario nuevoSocio = new Usuario();
        nuevoSocio.setDni(dto.getDni());
        nuevoSocio.setNombreCompleto(dto.getNombre() + " " + dto.getApellido());
        nuevoSocio.setEmail(dto.getEmail());
        
        // Contraseña por defecto (DNI). A futuro se encriptará con cifrado AES-256 o similar según tus RNF
        nuevoSocio.setPassword(dto.getDni()); 
        
        // Aplicamos el Control de Roles RBAC y Estado
        nuevoSocio.setRol(Rol.SOCIO); 
        nuevoSocio.setEstado(EstadoUsuario.PENDIENTE);
        nuevoSocio.setFechaRegistro(LocalDateTime.now());

        return usuarioRepository.save(nuevoSocio);

    }

    @Transactional(readOnly = true)
    public List<Usuario> obtenerTodosLosSocios() {
        // A futuro, podemos filtrar para que solo traiga a los que tienen RolUsuario.SOCIO
        return usuarioRepository.findAll();
    }

    @Transactional
    public void eliminarSocio(Long id) throws Exception {
        if (!usuarioRepository.existsById(id)) {
            throw new Exception("Socio no encontrado en la base de datos.");
        }
        usuarioRepository.deleteById(id);
    }

}