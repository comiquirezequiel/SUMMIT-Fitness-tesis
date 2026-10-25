package com.summit.backend.security;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Filtro JWT que intercepta cada request HTTP.
 * Extrae el token del header Authorization, lo valida y establece
 * el contexto de seguridad de Spring para la petición.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    // Con contraseña temporal solo se puede usar /api/auth (cambiarla o salir). El frontend reconoce el código
    // y lleva a la pantalla para cambiarla.
    private static final String DEBE_CAMBIAR_PASSWORD =
            "{\"error\":\"Antes de seguir tenés que cambiar tu contraseña\",\"codigo\":\"CAMBIAR_PASSWORD\"}";

    private final JwtTokenProvider jwtTokenProvider;
    private final CustomUserDetailsService customUserDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String token = getTokenFromRequest(request);

        if (StringUtils.hasText(token) && jwtTokenProvider.validateToken(token)) {
            String email = jwtTokenProvider.getEmailFromToken(token);

            // Si la cuenta se desactivó o se borró después de emitir el token, o si la contraseña cambió después
            // (se cerraron todas las sesiones), el pedido sigue sin autenticar y termina en 401: el frontend
            // vuelve al login
            UsuarioAutenticado usuario = cargarUsuario(email);
            if (usuario != null && usuario.isEnabled()
                    && !usuario.tokenAnteriorAlCambio(jwtTokenProvider.getIssuedAt(token))) {
                if (usuario.isDebeCambiarPassword() && !request.getRequestURI().startsWith("/api/auth/")) {
                    response.setStatus(HttpStatus.FORBIDDEN.value());
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write(DEBE_CAMBIAR_PASSWORD);
                    return;
                }

                UsernamePasswordAuthenticationToken authenticationToken =
                        new UsernamePasswordAuthenticationToken(
                                usuario,
                                null,
                                usuario.getAuthorities()
                        );

                authenticationToken.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request)
                );

                SecurityContextHolder.getContext().setAuthentication(authenticationToken);
            }
        }

        filterChain.doFilter(request, response);
    }

    private UsuarioAutenticado cargarUsuario(String email) {
        try {
            return customUserDetailsService.loadUserByUsername(email);
        } catch (UsernameNotFoundException e) {
            return null;
        }
    }

    /**
     * Extrae el token Bearer del header Authorization.
     */
    private String getTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
