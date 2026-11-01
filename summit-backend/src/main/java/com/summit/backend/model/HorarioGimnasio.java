package com.summit.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalTime;

/**
 * Horario de un día de la semana del gimnasio. Sin horas (abre y cierra en null) = ese día no abre: las métricas no lo
 * cuentan como un día sin gente.
 */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class HorarioGimnasio {

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR) // texto, no ENUM de MySQL: agregar valores no rompe la base
    @Column(name = "dia", nullable = false, length = 10)
    private DiaSemana dia;

    @Column(name = "abre")
    private LocalTime abre;

    @Column(name = "cierra")
    private LocalTime cierra;

    public boolean abierto() {
        return abre != null && cierra != null;
    }
}
