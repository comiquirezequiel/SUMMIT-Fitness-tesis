package com.summit.backend.dto;

import com.summit.backend.model.CanalContacto;
import com.summit.backend.model.EstadoTarea;
import jakarta.validation.constraints.Size;

/**
 * Resolver una tarea (estado HECHA o DESCARTADA) o registrar un contacto con un socio (idSocio): por qué canal y qué
 * pasó.
 */
public record ContactoRequestDTO(
        Long idSocio,        // solo al registrar un contacto
        EstadoTarea estado,  // solo al resolver una tarea: HECHA o DESCARTADA
        CanalContacto canal,

        @Size(max = 300, message = "La nota no puede superar los 300 caracteres")
        String nota
) {
}
