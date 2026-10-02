package com.summit.backend.config;

import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Plan;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.PlanRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Carga los datos mínimos para que el sistema sea usable en una instalación nueva.
 * Es idempotente: solo crea lo que falta y nunca modifica datos existentes.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements ApplicationRunner {

    private final UsuarioRepository usuarioRepository;
    private final PlanRepository planRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${summit.seed.admin.email}")
    private String adminEmail;

    @Value("${summit.seed.admin.password}")
    private String adminPassword;

    @Value("${summit.seed.admin.dni}")
    private String adminDni;

    @Override
    public void run(ApplicationArguments args) {
        crearAdminInicial();
        crearPlanesBase();
    }

    /**
     * El registro público solo crea socios, así que sin este admin
     * no habría forma de entrar al panel en una base vacía.
     */
    private void crearAdminInicial() {
        if (usuarioRepository.existsByRol(Rol.ADMIN)) {
            return;
        }
        if (usuarioRepository.existsByEmail(adminEmail) || usuarioRepository.existsByDni(adminDni)) {
            log.warn("No se creó el admin inicial: el email {} o el DNI {} ya están en uso por otro usuario", adminEmail, adminDni);
            return;
        }

        usuarioRepository.save(Usuario.builder()
                .dni(adminDni)
                .nombreCompleto("Administrador")
                .email(adminEmail)
                .password(passwordEncoder.encode(adminPassword))
                .rol(Rol.ADMIN)
                .estado(EstadoUsuario.ACTIVO)
                .build());
        log.warn("Se creó el admin inicial {} con la contraseña de summit.seed.admin.password. Cambiala después del primer login.", adminEmail);
    }

    /**
     * Planes de la tesis: Pase Libre, 3 veces por semana y 2 veces por semana.
     * Los precios son de referencia y se editan desde la gestión de planes.
     */
    private void crearPlanesBase() {
        crearPlanSiNoExiste("Pase Libre", "Acceso libre todos los días.", "25000", null);
        crearPlanSiNoExiste("3 veces por semana", "Hasta 3 días de acceso por semana.", "20000", 3);
        crearPlanSiNoExiste("2 veces por semana", "Hasta 2 días de acceso por semana.", "16000", 2);
    }

    private void crearPlanSiNoExiste(String nombre, String descripcion, String precio, Integer vecesPorSemana) {
        if (planRepository.existsByNombrePlan(nombre)) {
            return;
        }
        planRepository.save(Plan.builder()
                .nombrePlan(nombre)
                .descripcion(descripcion)
                .precioBase(new BigDecimal(precio))
                .duracionDias(30)
                .vecesPorSemana(vecesPorSemana)
                .activo(true)
                .build());
        log.info("Plan base creado: {}", nombre);
    }
}
