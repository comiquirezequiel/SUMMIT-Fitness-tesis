package com.summit.backend.service;

import com.summit.backend.model.ConfiguracionAcceso;
import com.summit.backend.repository.ConfiguracionAccesoRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConfiguracionAccesoService {

    private final ConfiguracionAccesoRepository repository;
    private static final Long CONFIG_GLOBAL_ID = 1L;

    /**
     * Asegura que exista una configuración global por defecto al iniciar la aplicación.
     */
    @PostConstruct
    public void initDefaultConfig() {
        if (!repository.existsById(CONFIG_GLOBAL_ID)) {
            log.info("Creando configuración de acceso por defecto...");
            ConfiguracionAcceso defaultConfig = ConfiguracionAcceso.builder()
                    .idConfiguracion(CONFIG_GLOBAL_ID)
                    .requerirMembresiaActiva(true)
                    .requerirCertificadoMedico(true)
                    .permitirOverrideManual(false)
                    .diasGraciaMembresia(3)
                    .diasGraciaCertificado(7)
                    .build();
            repository.save(defaultConfig);
        }
    }

    public ConfiguracionAcceso obtenerConfiguracionGlobal() {
        return repository.findById(CONFIG_GLOBAL_ID)
                .orElseThrow(() -> new RuntimeException("Configuración global no encontrada"));
    }

    public ConfiguracionAcceso actualizarConfiguracion(ConfiguracionAcceso config) {
        config.setIdConfiguracion(CONFIG_GLOBAL_ID); // Forzar que solo modifique la global
        return repository.save(config);
    }
}
