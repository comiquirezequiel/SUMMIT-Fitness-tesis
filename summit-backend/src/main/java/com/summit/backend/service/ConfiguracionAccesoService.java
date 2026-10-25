package com.summit.backend.service;

import com.summit.backend.model.ConfiguracionAcceso;
import com.summit.backend.repository.ConfiguracionAccesoRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConfiguracionAccesoService {

    private final ConfiguracionAccesoRepository repository;
    private static final Long CONFIG_GLOBAL_ID = 1L;

    // Radio de ingreso con QR si el admin no cargó otro, y los límites que se aceptan
    public static final int RADIO_INGRESO_POR_DEFECTO = 20;
    private static final int RADIO_MINIMO = 5;
    private static final int RADIO_MAXIMO = 500;

    // Código del QR de ingreso: sin letras que se confunden (0/O, 1/I/L)
    private static final String CARACTERES_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int LARGO_CODIGO = 20;
    private final SecureRandom azar = new SecureRandom();

    /**
     * Asegura que exista una configuración global por defecto al iniciar la aplicación, con su código de QR de
     * ingreso (las instalaciones anteriores a la A4 no lo tenían).
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
                    .radioIngresoMetros(RADIO_INGRESO_POR_DEFECTO)
                    .codigoQrIngreso(codigoNuevo())
                    .build();
            repository.save(defaultConfig);
        }
        ConfiguracionAcceso config = obtenerConfiguracionGlobal();
        if (config.getCodigoQrIngreso() == null) {
            config.setCodigoQrIngreso(codigoNuevo());
            repository.save(config);
        }
    }

    public ConfiguracionAcceso obtenerConfiguracionGlobal() {
        return repository.findById(CONFIG_GLOBAL_ID)
                .orElseThrow(() -> new RuntimeException("Configuración global no encontrada"));
    }

    /**
     * Guarda lo que se edita en Reglas de acceso (la pantalla manda la configuración completa que leyó). Se
     * copian solo los campos editables sobre la configuración guardada: el código del QR no cambia aunque venga
     * en el pedido, solo con regenerarCodigoQr.
     */
    public ConfiguracionAcceso actualizarConfiguracion(ConfiguracionAcceso cambios) {
        ConfiguracionAcceso config = obtenerConfiguracionGlobal();
        config.setRequerirMembresiaActiva(cambios.isRequerirMembresiaActiva());
        config.setRequerirCertificadoMedico(cambios.isRequerirCertificadoMedico());
        config.setPermitirOverrideManual(cambios.isPermitirOverrideManual());
        config.setDiasGraciaMembresia(cambios.getDiasGraciaMembresia());
        config.setDiasGraciaCertificado(cambios.getDiasGraciaCertificado());

        Double latitud = cambios.getLatitudGimnasio();
        Double longitud = cambios.getLongitudGimnasio();
        if ((latitud == null) != (longitud == null)) {
            throw new IllegalArgumentException("Cargá la latitud y la longitud del gimnasio, o ninguna de las dos");
        }
        if (latitud != null && (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180)) {
            throw new IllegalArgumentException("La ubicación del gimnasio no es válida");
        }
        Integer radio = cambios.getRadioIngresoMetros() != null ? cambios.getRadioIngresoMetros() : RADIO_INGRESO_POR_DEFECTO;
        if (radio < RADIO_MINIMO || radio > RADIO_MAXIMO) {
            throw new IllegalArgumentException("El radio de ingreso tiene que estar entre " + RADIO_MINIMO + " y "
                    + RADIO_MAXIMO + " metros");
        }
        if (cambios.isIngresoQrHabilitado() && latitud == null) {
            throw new IllegalArgumentException("Para habilitar el ingreso con QR, primero cargá la ubicación del gimnasio");
        }
        config.setLatitudGimnasio(latitud);
        config.setLongitudGimnasio(longitud);
        config.setRadioIngresoMetros(radio);
        config.setIngresoQrHabilitado(cambios.isIngresoQrHabilitado());
        return repository.save(config);
    }

    /** Código nuevo para el QR de ingreso: los QR impresos con el anterior dejan de servir. */
    public ConfiguracionAcceso regenerarCodigoQr() {
        ConfiguracionAcceso config = obtenerConfiguracionGlobal();
        config.setCodigoQrIngreso(codigoNuevo());
        log.info("Se generó un código nuevo para el QR de ingreso: los QR impresos anteriores dejan de servir");
        return repository.save(config);
    }

    /** Radio de ingreso con QR en metros (el por defecto si no se cargó otro). */
    public static int radioIngreso(ConfiguracionAcceso config) {
        return config.getRadioIngresoMetros() != null ? config.getRadioIngresoMetros() : RADIO_INGRESO_POR_DEFECTO;
    }

    private String codigoNuevo() {
        StringBuilder codigo = new StringBuilder(LARGO_CODIGO);
        for (int i = 0; i < LARGO_CODIGO; i++) {
            codigo.append(CARACTERES_CODIGO.charAt(azar.nextInt(CARACTERES_CODIGO.length())));
        }
        return codigo.toString();
    }
}
