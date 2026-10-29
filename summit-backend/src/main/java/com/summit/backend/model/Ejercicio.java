package com.summit.backend.model;

import lombok.*;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "ejercicios")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ejercicio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ejercicio")
    private Long idEjercicio;

    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @Column(name = "descripcion", length = 500)
    private String descripcion;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR) // texto, no ENUM de MySQL: agregar valores no rompe la base
    @Column(name = "grupo_muscular", nullable = false, length = 30)
    private GrupoMuscular grupoMuscular;

    @Column(name = "url_media", length = 255) // URL gif / video / imagen
    private String urlMedia;

    @Column(name = "svg_target_id", length = 50) // Identificador en el SVG 2D
    private String svgTargetId;

    @Column(name = "patologias_contraindicadas", length = 500)
    private String patologiasContraindicadas; // Separadas por comas (ej. "HERNIA,ASMA,RODILLA")
}
