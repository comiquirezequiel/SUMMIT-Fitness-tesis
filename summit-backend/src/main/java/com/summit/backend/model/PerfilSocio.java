package com.summit.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import jakarta.persistence.*;
import java.time.LocalDate;

/**
 * Datos personales del socio que no hacen al inicio de sesión.
 * Tabla separada de "usuarios" (relación 1 a 1) para mantener la normalización.
 */
@Entity
@Table(name = "perfiles_socio")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PerfilSocio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_perfil")
    private Long idPerfil;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false, unique = true)
    private Usuario usuario;

    @Column(name = "fecha_nacimiento")
    private LocalDate fechaNacimiento;

    @Column(name = "genero", length = 20)
    private String genero;

    @Column(name = "domicilio", length = 150)
    private String domicilio;

    @Column(name = "ciudad", length = 80)
    private String ciudad;

    @Column(name = "objetivo", length = 150)
    private String objetivo;

    @Column(name = "observaciones", length = 500)
    private String observaciones;
}
