package com.summit.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;

/**
 * Datos de un ejercicio dentro de la rutina (alta y edición).
 * En la edición (PUT) solo cambia lo que viene en el JSON: lo que no se manda queda igual y lo que
 * se manda vacío (null o "") se borra. Día y orden vacíos dejan el ejercicio donde estaba.
 */
@Getter
@Setter
@NoArgsConstructor
public class RutinaEjercicioRequestDTO {

    private Long idEjercicio;
    private Integer diaNumero;
    private Integer orden;
    private Integer series;
    private Integer repeticiones;
    private Double pesoSugeridoKg;
    private Integer descansoSegundos;
    private String observaciones;

    // Formato anterior del Constructor de Rutinas: "ejercicio": {"idEjercicio": 3}
    private ReferenciaEjercicio ejercicio;

    @JsonIgnore
    private final Set<String> enviados = new HashSet<>();

    public Long idEjercicioIndicado() {
        if (idEjercicio != null) return idEjercicio;
        return ejercicio != null ? ejercicio.getIdEjercicio() : null;
    }

    /** Indica si el campo vino en el JSON (aunque sea vacío). */
    public boolean vino(String campo) {
        return enviados.contains(campo);
    }

    public void setSeries(Integer series) {
        this.series = series;
        enviados.add("series");
    }

    public void setRepeticiones(Integer repeticiones) {
        this.repeticiones = repeticiones;
        enviados.add("repeticiones");
    }

    public void setPesoSugeridoKg(Double pesoSugeridoKg) {
        this.pesoSugeridoKg = pesoSugeridoKg;
        enviados.add("pesoSugeridoKg");
    }

    public void setDescansoSegundos(Integer descansoSegundos) {
        this.descansoSegundos = descansoSegundos;
        enviados.add("descansoSegundos");
    }

    public void setObservaciones(String observaciones) {
        this.observaciones = observaciones;
        enviados.add("observaciones");
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class ReferenciaEjercicio {
        private Long idEjercicio;
    }
}
