package com.summit.backend.service;

import com.summit.backend.config.AppSocios;
import com.summit.backend.dto.AuthResponse;
import com.summit.backend.dto.LoginRequest;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.UsuarioRepository;
import com.summit.backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Servicio de autenticación.
 * Gestiona el login con contraseñas encriptadas con BCrypt y la generación del JWT.
 * El socio además recibe una sesión renovable (SesionService) para que la app del celular no le pida la
 * contraseña cada vez que vence su token; el personal sigue con un token de jwt.expiration y sin renovación.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final SesionService sesionService;
    private final PasswordService passwordService;
    private final AppSocios appSocios;

    // Duración del token del socio: corta, porque la app lo renueva sola con la sesión
    @Value("${summit.sesion.socio.token-minutos:60}")
    private long minutosTokenSocio;

    /** Respuesta para la app y, si es un socio, la sesión renovable que va en la cookie (null para el personal). */
    public record ResultadoAutenticacion(AuthResponse respuesta, SesionService.SesionNueva sesion) {}

    /**
     * Autentica un usuario por email y contraseña.
     * @param dispositivo User-Agent del navegador o la app (queda en la sesión del socio)
     * @throws RuntimeException si las credenciales son inválidas
     */
    public ResultadoAutenticacion login(LoginRequest request, String dispositivo) {
        Usuario usuario = usuarioRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Credenciales inválidas"));

        if (!passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            throw new RuntimeException("Credenciales inválidas");
        }

        if (usuario.getEstado() != EstadoUsuario.ACTIVO) {
            throw new RuntimeException("La cuenta está " + textoEstado(usuario.getEstado()) + ": comunicate con el gimnasio");
        }

        // App del socio suspendida (AppSocios): el login queda solo para el personal
        if (usuario.getRol() == Rol.SOCIO && !appSocios.habilitada()) {
            throw new RuntimeException("La app para socios todavía no está disponible: por cualquier consulta, acercate a recepción");
        }

        return entrar(usuario, dispositivo);
    }

    /**
     * Cambia la propia contraseña (pidiendo la actual) y da un token nuevo: los anteriores y las sesiones
     * abiertas en otros dispositivos dejan de servir.
     * @throws IllegalArgumentException si la actual no coincide o la nueva no sirve
     */
    public ResultadoAutenticacion cambiarPassword(String email, String actual, String nueva, String dispositivo) {
        return entrar(passwordService.cambiar(email, actual, nueva), dispositivo);
    }

    /**
     * Renueva el token del socio con su sesión (sin contraseña) y rota la sesión.
     * @throws SesionService.SesionInvalidaException si la sesión no sirve más: hay que volver a entrar
     */
    public ResultadoAutenticacion renovar(String tokenSesion, String dispositivo) {
        // Con la app del socio suspendida, las sesiones que quedaron abiertas en los celulares ya no se renuevan
        if (!appSocios.habilitada()) {
            throw new SesionService.SesionInvalidaException();
        }
        SesionService.Renovacion renovacion = sesionService.renovar(tokenSesion, dispositivo);
        Usuario usuario = renovacion.usuario();
        return new ResultadoAutenticacion(respuesta(usuario, tokenDeSocio(usuario), renovacion.sesion()), renovacion.sesion());
    }

    /** Cierra la sesión renovable de este dispositivo. */
    public void salir(String tokenSesion) {
        sesionService.cerrar(tokenSesion);
    }

    // El socio recibe además una sesión renovable; el personal, un token de jwt.expiration
    private ResultadoAutenticacion entrar(Usuario usuario, String dispositivo) {
        if (usuario.getRol() == Rol.SOCIO) {
            SesionService.SesionNueva sesion = sesionService.abrir(usuario, dispositivo);
            return new ResultadoAutenticacion(respuesta(usuario, tokenDeSocio(usuario), sesion), sesion);
        }
        String token = jwtTokenProvider.generateToken(usuario.getEmail(), usuario.getRol().name());
        return new ResultadoAutenticacion(respuesta(usuario, token, null), null);
    }

    private String tokenDeSocio(Usuario usuario) {
        return jwtTokenProvider.generateToken(usuario.getEmail(), usuario.getRol().name(), Duration.ofMinutes(minutosTokenSocio));
    }

    private static AuthResponse respuesta(Usuario usuario, String token, SesionService.SesionNueva sesion) {
        return AuthResponse.builder()
                .token(token)
                .idUsuario(usuario.getIdUsuario())
                .email(usuario.getEmail())
                .nombreCompleto(usuario.getNombreCompleto())
                .rol(usuario.getRol().name())
                .renovableHasta(sesion == null ? null : sesion.vence())
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
