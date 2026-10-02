package com.summit.backend.model;

import lombok.*;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "rutinas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Rutina {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_rutina")
    private Long idRutina;

    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @Column(name = "objetivo", length = 255)
    private String objetivo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "socio_id", nullable = false)
    private Usuario socio;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "profesor_id")
    private Usuario profesor;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDate fechaCreacion;

    @Column(name = "activa", nullable = false)
    private Boolean activa;

    @OneToMany(mappedBy = "rutina", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RutinaEjercicio> ejercicios = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (this.fechaCreacion == null) this.fechaCreacion = LocalDate.now();
        if (this.activa == null) this.activa = true;
    }
}
