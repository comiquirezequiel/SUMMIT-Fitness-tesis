package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Datos del gimnasio que ve el socio en la app (PLAN-APP-SOCIOS.md, A5): nombre, contacto, horarios, reglamento y
 * capacidad. Hay un único registro (id 1), que edita el admin en Ajustes > Datos del gimnasio.
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

    @Column(name = "reglamento", columnDefinition = "TEXT")
    private String reglamento;

    // Cuántas personas entran a la vez: con eso la ocupación en vivo dice si está tranquilo o lleno
    @Column(name = "capacidad")
    private Integer capacidad;

    // Logo (PNG) dentro de summit.uploads.dir; sale en los PDF. null = sin logo. No va en la API: se pide a
    // /api/configuracion/gimnasio/logo
    @Column(name = "logo_url", length = 255)
    private String logoUrl;

    // Cuándo se subió el logo: es su versión, para que el navegador no muestre uno viejo
    @Column(name = "logo_actualizado")
    private LocalDateTime logoActualizado;

    // Los 7 días, de lunes a domingo
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "datos_gimnasio_horarios", joinColumns = @JoinColumn(name = "id_datos"))
    @OrderColumn(name = "orden")
    @Builder.Default
    private List<HorarioGimnasio> horarios = new ArrayList<>();
}
