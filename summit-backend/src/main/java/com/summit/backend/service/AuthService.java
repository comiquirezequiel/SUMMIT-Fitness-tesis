package com.summit.backend.service;

import com.summit.backend.dto.AuthResponse;
import com.summit.backend.dto.LoginRequest;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.UsuarioRepository;
import com.summit.backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Servicio de autenticación del personal.
 * Gestiona el login con contraseñas encriptadas con BCrypt y la generación del JWT (dura jwt.expiration).
 * Los socios no entran al sistema: son fichas que maneja el personal.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordService passwordService;

    /**
     * Autentica a un usuario del personal por email y contraseña.
     * @throws BadCredentialsException si las credenciales son inválidas, la cuenta no está activa o es de un socio
     */
    public AuthResponse login(LoginRequest request) {
        Usuario usuario = usuarioRepository.findByEmail(request.email())
                .filter(u -> u.getRol() != Rol.SOCIO && u.getPassword() != null)
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas"));

        if (!passwordEncoder.matches(request.password(), usuario.getPassword())) {
            throw new BadCredentialsException("Credenciales inválidas");
        }

        if (usuario.getEstado() != EstadoUsuario.ACTIVO) {
            throw new BadCredentialsException("La cuenta está " + textoEstado(usuario.getEstado()) + ": comunicate con el administrador");
        }

        return respuesta(usuario);
    }

    /**
     * Cambia la propia contraseña (pidiendo la actual) y da un token nuevo: los anteriores dejan de servir.
     * @throws IllegalArgumentException si la actual no coincide o la nueva no sirve
     */
    public AuthResponse cambiarPassword(String email, String actual, String nueva) {
        return respuesta(passwordService.cambiar(email, actual, nueva));
    }

    private AuthResponse respuesta(Usuario usuario) {
        return AuthResponse.builder()
                .token(jwtTokenProvider.generateToken(usuario.getEmail(), usuario.getRol().name()))
                .idUsuario(usuario.getIdUsuario())
                .email(usuario.getEmail())
                .nombreCompleto(usuario.getNombreCompleto())
                .rol(usuario.getRol().name())
                .debeCambiarPassword(usuario.isDebeCambiarPassword())
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
