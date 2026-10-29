package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Datos del gimnasio: nombre, contacto y logo (salen en los comprobantes y las rutinas en PDF). Hay un único
 * registro (id 1), que edita el admin en Ajustes > Datos del gimnasio.
 */
@Entity
@Table(name = "datos_gimnasio")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DatosGimnasio {

    @Id
    @Column(name = "id_datos")
    private Long idDatos;

    @Column(name = "nombre", nullable = false, length = 80)
    private String nombre;

    @Column(name = "direccion", length = 150)
    private String direccion;

    @Column(name = "ciudad", length = 80)
    private String ciudad;

    @Column(name = "telefono", length = 25)
    private String telefono;

    // Solo dígitos, con código de país y de área (ej. 5491123456789): es lo que pide el link de WhatsApp
    @Column(name = "whatsapp", length = 15)
    private String whatsapp;

    @Column(name = "email", length = 100)
    private String email;

    // Usuario de Instagram, sin @
    @Column(name = "instagram", length = 30)
    private String instagram;

    // Logo (PNG) dentro de summit.uploads.dir; sale en los PDF. null = sin logo. No va en la API: se pide a
    // /api/configuracion/gimnasio/logo
    @Column(name = "logo_url", length = 255)
    private String logoUrl;

    // Cuándo se subió el logo: es su versión, para que el navegador no muestre uno viejo
    @Column(name = "logo_actualizado")
    private LocalDateTime logoActualizado;
}
