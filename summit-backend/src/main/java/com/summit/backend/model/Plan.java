package com.summit.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "planes")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"}) // proxies LAZY de Hibernate
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Plan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_plan")
    private Long idPlan;

    @Column(name = "nombre_plan", unique = true, nullable = false, length = 50)
    private String nombrePlan;

    @Column(name = "descripcion", length = 255)
    private String descripcion;

    @Column(name = "precio_base", nullable = false, precision = 10, scale = 2)
    private BigDecimal precioBase;

    @Column(name = "duracion_dias", nullable = false)
    private Integer duracionDias; // e.g. 30 días para plan mensual

    @Column(name = "activo", nullable = false)
    private Boolean activo;

    @PrePersist
    public void prePersist() {
        if (this.activo == null) this.activo = true;
        if (this.duracionDias == null) this.duracionDias = 30;
    }
}
