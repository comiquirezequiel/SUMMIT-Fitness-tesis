package com.summit.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;

/**
 * Alta o edición de una rutina.
 * En la edición (PUT) solo cambia lo que viene en el JSON: lo que no se manda queda igual.
 */
@Getter
@Setter
@NoArgsConstructor
public class RutinaRequestDTO {

    private Long idSocio;
    private Long idProfesor; // Opcional: solo lo usa un ADMIN (si la crea un PROFESOR, es él)
    private String nombre;
    private String objetivo;

    // Formato anterior del Constructor de Rutinas: "socio": {"idUsuario": 5}
    private ReferenciaUsuario socio;

    @JsonIgnore
    private final Set<String> enviados = new HashSet<>();

    public Long idSocioIndicado() {
        if (idSocio != null) return idSocio;
        return socio != null ? socio.getIdUsuario() : null;
    }

    /** Indica si el campo vino en el JSON (aunque sea vacío). */
    public boolean vino(String campo) {
        return enviados.contains(campo);
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
        enviados.add("nombre");
    }

    public void setObjetivo(String objetivo) {
        this.objetivo = objetivo;
        enviados.add("objetivo");
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class ReferenciaUsuario {
        private Long idUsuario;
    }
}
