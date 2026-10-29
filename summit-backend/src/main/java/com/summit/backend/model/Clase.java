package com.summit.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import jakarta.persistence.*;

@Entity
@Table(name = "clases")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"}) // proxies LAZY de Hibernate
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Clase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_clase")
    private Long idClase;

    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @Column(name = "descripcion", length = 300)
    private String descripcion;

    @Column(name = "capacidad_maxima", nullable = false)
    private Integer capacidadMaxima;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "profesor_id")
    private Usuario profesor;

    @Column(name = "activa", nullable = false)
    private Boolean activa;

    @PrePersist
    public void prePersist() {
        if (this.activa == null) this.activa = true;
    }
}
