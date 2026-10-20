package com.summit.backend.service;

import com.summit.backend.dto.AuthResponse;
import com.summit.backend.dto.LoginRequest;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.UsuarioRepository;
import com.summit.backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Servicio de autenticación.
 * Gestiona el login con contraseñas encriptadas con BCrypt y la generación del JWT.
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
            throw new RuntimeException("La cuenta está " + textoEstado(usuario.getEstado()) + ": comunicate con el gimnasio");
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

    // "cuenta" es femenino: el nombre del enum (INACTIVO, CANCELADO...) no sirve tal cual
    private static String textoEstado(EstadoUsuario estado) {
        return switch (estado) {
            case INACTIVO -> "inactiva";
            case PENDIENTE -> "pendiente de activación";
            case SUSPENDIDO -> "suspendida";
            case CANCELADO -> "dada de baja";
            default -> estado.name().toLowerCase();
        };
    }
}
