package com.summit.backend.controller;

import com.summit.backend.arca.ConfiguracionArca;
import com.summit.backend.dto.AuthResponse;
import com.summit.backend.dto.LoginRequest;
import com.summit.backend.mercadopago.PasarelaTarjeta;
import com.summit.backend.service.AuthService;
import com.summit.backend.service.PasswordService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.Map;

/**
 * Controller de autenticación del personal: login y contraseñas. Todo público (sin token), salvo cambiar la
 * propia contraseña.
 * No hay registro público: las cuentas del personal las crea un ADMIN (POST /api/usuarios).
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordService passwordService;
    private final ConfiguracionArca configuracionArca;
    private final PasarelaTarjeta pasarelaTarjeta;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            return ResponseEntity.ok(authService.login(request));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Cambia la propia contraseña pidiendo la actual (desde el panel o la pantalla de la contraseña temporal).
     * Pide token (SecurityConfig). Responde como el login, con un token nuevo: los anteriores dejan de servir.
     */
    @PutMapping("/password")
    public ResponseEntity<?> cambiarPassword(@RequestBody Map<String, String> datos, Authentication auth) {
        try {
            AuthResponse respuesta = authService.cambiarPassword(auth.getName(), datos.get("actual"), datos.get("nueva"));
            return ResponseEntity.ok(respuesta);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Qué funciones opcionales están activas, para que el frontend muestre solo esas: "¿Olvidaste tu contraseña?"
     * por email (hace falta un correo saliente configurado), la factura electrónica de ARCA (summit.arca.habilitada)
     * y el cobro con tarjeta por Mercado Pago (summit.pagos.tarjeta.modo).
     */
    @GetMapping("/funciones")
    public Map<String, Boolean> funciones() {
        return Map.of("recuperacionPorEmail", passwordService.recuperacionDisponible(),
                "facturacion", configuracionArca.habilitada(), "cobroConTarjeta", pasarelaTarjeta.habilitada());
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
}
