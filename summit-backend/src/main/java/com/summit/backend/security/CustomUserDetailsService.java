package com.summit.backend.security;

import com.summit.backend.model.Usuario;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

/**
 * Servicio de carga de usuarios para Spring Security.
 * Busca el usuario por email en la base de datos y mapea su rol a una autoridad.
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "No se encontró un usuario con el email: " + email));

        // Mapear el rol del usuario a una autoridad de Spring Security (ROLE_ADMIN, ROLE_SOCIO, etc.)
        GrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + usuario.getRol().name());
        List<GrantedAuthority> authorities = Collections.singletonList(authority);

        return new User(
                usuario.getEmail(),
                usuario.getPassword(),
                authorities
        );
    }
}
