package com.summit.backend.security;

import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Usuario;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Collection;
import java.util.Date;

/**
 * Usuario del pedido en curso (lo arma CustomUserDetailsService en cada pedido). Además de lo que necesita
 * Spring, trae lo de su contraseña que mira JwtAuthenticationFilter.
 */
@Getter
public class UsuarioAutenticado extends User {

    // Entró con una contraseña temporal: hasta que la cambie, solo puede usar /api/auth
    private final boolean debeCambiarPassword;
    // Último cambio de contraseña (null si nunca la cambió)
    private final LocalDateTime passwordCambiada;

    public UsuarioAutenticado(Usuario usuario, Collection<? extends GrantedAuthority> autoridades) {
        // Una cuenta que no está ACTIVO (dada de baja, desactivada, suspendida) queda deshabilitada:
        // el filtro JWT deja de aceptar sus tokens aunque todavía no hayan vencido
        super(usuario.getEmail(), usuario.getPassword(), usuario.getEstado() == EstadoUsuario.ACTIVO,
                true, true, true, autoridades);
        this.debeCambiarPassword = usuario.isDebeCambiarPassword();
        this.passwordCambiada = usuario.getPasswordCambiada();
    }

    /**
     * Si el token se emitió antes del último cambio de contraseña: ya no sirve. Se compara en segundos, que es
     * lo que guarda el token (passwordCambiada también se guarda en segundos).
     */
    public boolean tokenAnteriorAlCambio(Date emitido) {
        if (passwordCambiada == null) {
            return false;
        }
        long cambio = passwordCambiada.atZone(ZoneId.systemDefault()).toEpochSecond();
        return emitido == null || emitido.getTime() / 1000 < cambio;
    }
}
