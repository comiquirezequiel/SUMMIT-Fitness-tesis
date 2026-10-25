package com.summit.backend.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entidad de configuración global o por sucursal.
 * Actualmente se utiliza el ID 1 fijo como configuración global de la sucursal matriz.
 */
@Entity
@Table(name = "configuracion_acceso")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConfiguracionAcceso {

    @Id
    private Long idConfiguracion;

    // --- Toggles / Switches Booleanos ---
    private boolean requerirMembresiaActiva;
    private boolean requerirCertificadoMedico;
    private boolean permitirOverrideManual;

    // --- Períodos de Gracia (Días) ---
    private int diasGraciaMembresia;
    private int diasGraciaCertificado;

    // --- Ingreso con QR desde la app del socio (PLAN-APP-SOCIOS.md, A4) ---
    // El socio escanea el QR impreso en recepción y su ubicación tiene que estar dentro del radio del gimnasio.
    private boolean ingresoQrHabilitado;

    // Ubicación del gimnasio (se carga desde Reglas de acceso, parado en el lugar). null = sin configurar
    private Double latitudGimnasio;
    private Double longitudGimnasio;

    // Distancia máxima al gimnasio para ingresar con el QR. null = 20 metros
    private Integer radioIngresoMetros;

    // Lo que dice el QR impreso, después de "SUMMIT-INGRESO:". Si se publica, el admin genera uno nuevo y
    // los QR impresos anteriores dejan de servir
    private String codigoQrIngreso;
}
