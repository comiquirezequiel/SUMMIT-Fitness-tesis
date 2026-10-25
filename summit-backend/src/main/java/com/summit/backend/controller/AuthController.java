package com.summit.backend.controller;

import com.summit.backend.dto.LoginRequest;
import com.summit.backend.service.AuthService;
import com.summit.backend.service.PasswordService;
import com.summit.backend.service.SesionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Controller de autenticación: login, renovación de la sesión del socio, salida y contraseñas. Todo público (sin
 * token), salvo cambiar la propia contraseña.
 * No hay registro público: las cuentas de los socios las crea recepción (POST /api/socios) y las del
 * personal, un ADMIN (POST /api/usuarios).
 *
 * <p>La sesión renovable del socio viaja en la cookie summit_sesion: HttpOnly (el JavaScript no la puede leer),
 * Secure (solo por HTTPS; los navegadores la aceptan también en localhost), SameSite=Strict (otro sitio no la
 * puede mandar) y limitada a /api/auth, el único lugar donde hace falta.</p>
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String COOKIE_SESION = "summit_sesion";

    private final AuthService authService;
    private final PasswordService passwordService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request,
                                   @CookieValue(name = COOKIE_SESION, required = false) String sesionAnterior,
                                   @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String dispositivo) {
        try {
            AuthService.ResultadoAutenticacion resultado = authService.login(request, dispositivo);
            // Si el navegador traía una sesión anterior (por ejemplo, se salió sin conexión y el servidor no se
            // enteró), se cierra: la nueva la reemplaza
            authService.salir(sesionAnterior);
            return conSesion(resultado).body(resultado.respuesta());
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /** La app del socio pide un token nuevo con su sesión, sin la contraseña. */
    @PostMapping("/renovar")
    public ResponseEntity<?> renovar(@CookieValue(name = COOKIE_SESION, required = false) String tokenSesion,
                                     @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String dispositivo) {
        try {
            AuthService.ResultadoAutenticacion resultado = authService.renovar(tokenSesion, dispositivo);
            return conSesion(resultado).body(resultado.respuesta());
        } catch (SesionService.SesionInvalidaException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .header(HttpHeaders.SET_COOKIE, cookieBorrada().toString())
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Cambia la propia contraseña pidiendo la actual (desde el panel, el portal o la pantalla de la contraseña
     * temporal). Pide token (SecurityConfig). Responde como el login, con un token nuevo: los anteriores y las
     * sesiones abiertas en otros dispositivos dejan de servir.
     */
    @PutMapping("/password")
    public ResponseEntity<?> cambiarPassword(@RequestBody Map<String, String> datos, Authentication auth,
                                             @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String dispositivo) {
        try {
            AuthService.ResultadoAutenticacion resultado = authService.cambiarPassword(
                    auth.getName(), datos.get("actual"), datos.get("nueva"), dispositivo);
            return conSesion(resultado).body(resultado.respuesta());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Si el login puede ofrecer "¿Olvidaste tu contraseña?" (hace falta un correo saliente configurado). */
    @GetMapping("/recuperacion")
    public Map<String, Boolean> recuperacion() {
        return Map.of("porEmail", passwordService.recuperacionDisponible());
    }

    /**
     * "¿Olvidaste tu contraseña?": manda un link para elegir una nueva, si el email es de una cuenta activa.
     * Responde siempre lo mismo, para no revelar qué emails están registrados.
     */
    @PostMapping("/olvide-password")
    public ResponseEntity<?> olvidePassword(@RequestBody Map<String, String> datos) {
        try {
            passwordService.solicitarRecuperacion(datos.get("email"));
            return ResponseEntity.ok(Map.of("mensaje",
                    "Si el email es de una cuenta del gimnasio, te llega un link para elegir una contraseña nueva. Mirá también en spam."));
        } catch (PasswordService.RecuperacionNoDisponibleException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Elige una contraseña nueva con el link del mail. Devuelve el email, para entrar. */
    @PostMapping("/restablecer-password")
    public ResponseEntity<?> restablecerPassword(@RequestBody Map<String, String> datos) {
        try {
            return ResponseEntity.ok(Map.of("email", passwordService.restablecerConToken(datos.get("token"), datos.get("password"))));
        } catch (PasswordService.LinkInvalidoException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage(), "codigo", "LINK_INVALIDO"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Cierra la sesión de este dispositivo y borra la cookie. */
    @PostMapping("/salir")
    public ResponseEntity<Void> salir(@CookieValue(name = COOKIE_SESION, required = false) String tokenSesion) {
        authService.salir(tokenSesion);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookieBorrada().toString())
                .build();
    }

    // Respuesta 200 con la cookie de la sesión renovable, si la hay (solo socios)
    private static ResponseEntity.BodyBuilder conSesion(AuthService.ResultadoAutenticacion resultado) {
        ResponseEntity.BodyBuilder respuesta = ResponseEntity.ok();
        if (resultado.sesion() != null) {
            Duration vigencia = Duration.between(LocalDateTime.now(), resultado.sesion().vence());
            respuesta.header(HttpHeaders.SET_COOKIE, cookie(resultado.sesion().token(), vigencia).toString());
        }
        return respuesta;
    }

    private static ResponseCookie cookie(String valor, Duration vigencia) {
        return ResponseCookie.from(COOKIE_SESION, valor)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(vigencia)
                .build();
    }

    private static ResponseCookie cookieBorrada() {
        return cookie("", Duration.ZERO);
    }
}
