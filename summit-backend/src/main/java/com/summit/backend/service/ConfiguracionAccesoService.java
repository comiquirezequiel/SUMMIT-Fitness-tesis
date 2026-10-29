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
            repository.save(ConfiguracionAcceso.builder()
                    .idConfiguracion(CONFIG_GLOBAL_ID)
                    .requerirMembresiaActiva(true)
                    .requerirCertificadoMedico(true)
                    .permitirOverrideManual(false)
                    .diasGraciaMembresia(3)
                    .diasGraciaCertificado(7)
                    .build());
        }
    }

    public ConfiguracionAcceso obtenerConfiguracionGlobal() {
        return repository.findById(CONFIG_GLOBAL_ID)
                .orElseThrow(() -> new RuntimeException("Configuración global no encontrada"));
    }

    /**
     * Guarda lo que se edita en Reglas de acceso (la pantalla manda la configuración completa que leyó). Se
     * copian solo los campos editables sobre la configuración guardada.
     */
    public ConfiguracionAcceso actualizarConfiguracion(ConfiguracionAcceso cambios) {
        ConfiguracionAcceso config = obtenerConfiguracionGlobal();
        config.setRequerirMembresiaActiva(cambios.isRequerirMembresiaActiva());
        config.setRequerirCertificadoMedico(cambios.isRequerirCertificadoMedico());
        config.setPermitirOverrideManual(cambios.isPermitirOverrideManual());
        config.setDiasGraciaMembresia(cambios.getDiasGraciaMembresia());
        config.setDiasGraciaCertificado(cambios.getDiasGraciaCertificado());
        return repository.save(config);
    }
}
