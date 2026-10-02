package com.summit.backend.service;

import com.summit.backend.dto.AuthResponse;
import com.summit.backend.dto.LoginRequest;
import com.summit.backend.dto.RegisterRequest;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.UsuarioRepository;
import com.summit.backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Servicio de autenticación.
 * Gestiona login y registro de usuarios con encriptación BCrypt y generación de JWT.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    /**
     * Autentica un usuario por email y contraseña.
     * @throws RuntimeException si las credenciales son inválidas
     */
    public AuthResponse login(LoginRequest request) {
        Usuario usuario = usuarioRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Credenciales inválidas"));

        if (!passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            throw new RuntimeException("Credenciales inválidas");
        }

        if (usuario.getEstado() != EstadoUsuario.ACTIVO) {
            throw new RuntimeException("La cuenta se encuentra " + usuario.getEstado().name().toLowerCase());
        }

        String token = jwtTokenProvider.generateToken(usuario.getEmail(), usuario.getRol().name());

        return AuthResponse.builder()
                .token(token)
                .idUsuario(usuario.getIdUsuario())
                .email(usuario.getEmail())
                .nombreCompleto(usuario.getNombreCompleto())
                .rol(usuario.getRol().name())
                .build();
    }

    /**
     * Registra un nuevo usuario en el sistema.
     * @throws RuntimeException si el email o DNI ya están registrados
     */
    public AuthResponse register(RegisterRequest request) {
        if (usuarioRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("El email ya se encuentra registrado");
        }
        if (usuarioRepository.existsByDni(request.getDni())) {
            throw new RuntimeException("El DNI ya se encuentra registrado");
        }

        // Determinar rol (por defecto SOCIO)
        Rol rol = Rol.SOCIO;
        if (request.getRol() != null && !request.getRol().isEmpty()) {
            try {
                rol = Rol.valueOf(request.getRol().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new RuntimeException("Rol inválido: " + request.getRol());
            }
        }

        Usuario usuario = Usuario.builder()
                .dni(request.getDni())
                .nombreCompleto(request.getNombreCompleto())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .telefono(request.getTelefono())
                .rol(rol)
                .estado(EstadoUsuario.ACTIVO)
                .build();

        usuario = usuarioRepository.save(usuario);

        String token = jwtTokenProvider.generateToken(usuario.getEmail(), usuario.getRol().name());

        return AuthResponse.builder()
                .token(token)
                .idUsuario(usuario.getIdUsuario())
                .email(usuario.getEmail())
                .nombreCompleto(usuario.getNombreCompleto())
                .rol(usuario.getRol().name())
                .build();
    }
}
