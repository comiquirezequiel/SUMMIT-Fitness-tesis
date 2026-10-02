package com.summit.backend.config;

import com.summit.backend.security.CustomUserDetailsService;
import com.summit.backend.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Configuración central de Spring Security 6.
 * Define endpoints públicos/privados, CORS, sesión stateless y filtro JWT.
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomUserDetailsService customUserDetailsService;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(customUserDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            // Sin token o con token vencido: 401 (el 403 queda para "logueado pero sin permiso")
            .exceptionHandling(ex -> ex.authenticationEntryPoint(
                    new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(auth -> auth
                // Endpoints públicos (sin token)
                .requestMatchers("/api/auth/**", "/api/test/**").permitAll()
                // Página de error interna de Spring: si queda protegida, un 403 se convierte en 401
                .requestMatchers("/error").permitAll()

                // Usuarios del sistema: RECEPCION consulta; alta, edición y baja del personal solo ADMIN
                .requestMatchers(HttpMethod.GET, "/api/usuarios/**").hasAnyRole("ADMIN", "RECEPCION")
                .requestMatchers("/api/usuarios/**").hasRole("ADMIN")

                // Socios y certificados: el PROFESOR solo consulta (lo necesita el constructor de rutinas)
                .requestMatchers(HttpMethod.GET, "/api/socios/**").hasAnyRole("ADMIN", "RECEPCION", "PROFESOR")
                .requestMatchers("/api/socios/**").hasAnyRole("ADMIN", "RECEPCION")

                // Reglas de acceso del gimnasio: RECEPCION consulta, solo ADMIN modifica
                .requestMatchers(HttpMethod.GET, "/api/configuracion/**").hasAnyRole("ADMIN", "RECEPCION")
                .requestMatchers("/api/configuracion/**").hasRole("ADMIN")

                // Gestión de planes: solo ADMIN
                .requestMatchers(HttpMethod.POST, "/api/planes/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/planes/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/planes/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/planes/**").authenticated()

                // Suscripciones y pagos: ADMIN y RECEPCION
                .requestMatchers("/api/suscripciones/**").hasAnyRole("ADMIN", "RECEPCION")
                .requestMatchers("/api/pagos/**").hasAnyRole("ADMIN", "RECEPCION")

                // Asistencia / Check-in y tablero de recepción: ADMIN y RECEPCION
                .requestMatchers("/api/asistencia/**").hasAnyRole("ADMIN", "RECEPCION")
                .requestMatchers("/api/dashboard/**").hasAnyRole("ADMIN", "RECEPCION")

                // Rutinas: ADMIN y PROFESOR
                .requestMatchers(HttpMethod.POST, "/api/rutinas/**").hasAnyRole("ADMIN", "PROFESOR")
                .requestMatchers(HttpMethod.PUT, "/api/rutinas/**").hasAnyRole("ADMIN", "PROFESOR")
                .requestMatchers(HttpMethod.GET, "/api/rutinas/**").authenticated()

                // Catálogo de ejercicios: lo mantienen ADMIN y PROFESOR
                .requestMatchers(HttpMethod.POST, "/api/ejercicios/**").hasAnyRole("ADMIN", "PROFESOR")
                .requestMatchers(HttpMethod.PUT, "/api/ejercicios/**").hasAnyRole("ADMIN", "PROFESOR")

                // Clases: solo ADMIN las crea, edita o desactiva
                .requestMatchers(HttpMethod.POST, "/api/clases/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/clases/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/clases/**").hasRole("ADMIN")

                // Asistencia a clases (presente/ausente) y lista de inscriptos con DNI: personal del gimnasio
                .requestMatchers(HttpMethod.PATCH, "/api/reservas/**").hasAnyRole("ADMIN", "RECEPCION", "PROFESOR")
                .requestMatchers(HttpMethod.GET, "/api/reservas/horario/**").hasAnyRole("ADMIN", "RECEPCION", "PROFESOR")

                // Lectura de ejercicios y clases, y reservas: cualquier usuario autenticado
                // (un socio solo opera sobre sus propias reservas: lo controla ReservaController)
                .requestMatchers("/api/ejercicios/**", "/api/clases/**", "/api/reservas/**").authenticated()

                // Todo lo demás requiere autenticación
                .anyRequest().authenticated()
            );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(
                "http://localhost:5173",  // Vite dev server
                "http://localhost:3000"   // Alternativa
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}
