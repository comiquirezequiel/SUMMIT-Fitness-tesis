package com.summit.backend.config;

import com.summit.backend.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
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
 * Configuración central de Spring Security.
 * Define endpoints públicos/privados, CORS, sesión stateless y filtro JWT. El login lo resuelve AuthService
 * (contraseña con BCrypt) y cada pedido se autentica con su token en JwtAuthenticationFilter.
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    // Origenes del frontend que pueden llamar a la API (summit.cors.origins, separados por coma)
    @Value("${summit.cors.origins}")
    private List<String> origenesPermitidos;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            // Sin token o con token vencido: 401 (el 403 queda para "logueado pero sin permiso")
            .exceptionHandling(ex -> ex.authenticationEntryPoint(
                    new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(auth -> auth
                // Cambiar la propia contraseña: con token (también con una contraseña temporal)
                .requestMatchers(HttpMethod.PUT, "/api/auth/password").authenticated()
                // Endpoints públicos (sin token)
                .requestMatchers("/api/auth/**", "/api/test/**").permitAll()
                // Página de error interna de Spring: si queda protegida, un 403 se convierte en 401
                .requestMatchers("/error").permitAll()

                // Usuarios del sistema: RECEPCION consulta; alta, edición y baja del personal solo ADMIN
                .requestMatchers(HttpMethod.GET, "/api/usuarios/**").hasAnyRole("ADMIN", "RECEPCION")
                .requestMatchers("/api/usuarios/**").hasRole("ADMIN")

                // Socios y certificados: el PROFESOR solo consulta (lo necesita el constructor de rutinas)
                // Importar socios desde una planilla: solo el admin
                .requestMatchers(HttpMethod.POST, "/api/socios/importar").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/socios/**").hasAnyRole("ADMIN", "RECEPCION", "PROFESOR")
                .requestMatchers("/api/socios/**").hasAnyRole("ADMIN", "RECEPCION")

                // Datos del gimnasio: también los lee el PROFESOR (van en el encabezado del PDF de las rutinas)
                .requestMatchers(HttpMethod.GET, "/api/configuracion/gimnasio/**").hasAnyRole("ADMIN", "RECEPCION", "PROFESOR")
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
                // Un pago "a verificar" lo confirma o rechaza solo el ADMIN (no quien lo cobró)
                .requestMatchers(HttpMethod.POST, "/api/pagos/*/verificar").hasRole("ADMIN")
                .requestMatchers("/api/pagos/**").hasAnyRole("ADMIN", "RECEPCION")
                // Caja de recepción: gastos, turno y cierre (arqueo)
                .requestMatchers("/api/caja/**").hasAnyRole("ADMIN", "RECEPCION")
                // Seguimiento de socios: inactividad y tareas de contacto
                .requestMatchers("/api/seguimiento/**").hasAnyRole("ADMIN", "RECEPCION")
                // Factura electrónica: recepción ve los comprobantes y puede mandar ya lo pendiente; el resto, el ADMIN
                .requestMatchers(HttpMethod.GET, "/api/facturacion/**").hasAnyRole("ADMIN", "RECEPCION")
                .requestMatchers(HttpMethod.POST, "/api/facturacion/procesar").hasAnyRole("ADMIN", "RECEPCION")
                .requestMatchers("/api/facturacion/**").hasRole("ADMIN")
                // Débito automático desde recepción
                .requestMatchers("/api/debitos/**").hasAnyRole("ADMIN", "RECEPCION")

                // Asistencia del personal (horas trabajadas y correcciones): solo ADMIN
                .requestMatchers("/api/asistencia/personal/**").hasRole("ADMIN")
                // Asistencia / Check-in y tablero de recepción: ADMIN y RECEPCION
                .requestMatchers("/api/asistencia/**").hasAnyRole("ADMIN", "RECEPCION")

                // Asistente de IA (lee certificados y sugiere ejercicios): solo el personal
                // (un socio recibe 403: maneja datos de salud de otros socios y consume la GPU del gimnasio)
                .requestMatchers("/api/ia/**").hasAnyRole("ADMIN", "RECEPCION", "PROFESOR")
                .requestMatchers("/api/dashboard/**").hasAnyRole("ADMIN", "RECEPCION")
                // Métricas: la asistencia la ven ADMIN y RECEPCION; los ingresos, solo ADMIN
                .requestMatchers("/api/metricas/ingresos").hasRole("ADMIN")
                .requestMatchers("/api/metricas/**").hasAnyRole("ADMIN", "RECEPCION")

                // Rutinas: las arman ADMIN y PROFESOR. El cruce con las patologías del socio es dato de salud.
                // Consulta: cualquier usuario del personal
                .requestMatchers(HttpMethod.GET, "/api/rutinas/validar-ejercicio").hasAnyRole("ADMIN", "PROFESOR")
                .requestMatchers(HttpMethod.GET, "/api/rutinas/**").authenticated()
                .requestMatchers("/api/rutinas/**").hasAnyRole("ADMIN", "PROFESOR")

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

                // Lectura de ejercicios y clases, y reservas: cualquier usuario del personal
                .requestMatchers("/api/ejercicios/**", "/api/clases/**", "/api/reservas/**").authenticated()

                // Todo lo demás requiere autenticación
                .anyRequest().authenticated()
            );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(origenesPermitidos);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}
