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
}
