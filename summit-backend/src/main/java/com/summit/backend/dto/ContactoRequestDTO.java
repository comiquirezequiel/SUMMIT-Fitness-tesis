package com.summit.backend.dto;

import com.summit.backend.model.CanalContacto;
import com.summit.backend.model.EstadoTarea;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Resolver una tarea (estado HECHA o DESCARTADA) o registrar un contacto con un socio (idSocio): por qué canal y qué
 * pasó.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ContactoRequestDTO {

    private Long idSocio;        // solo al registrar un contacto
    private EstadoTarea estado;  // solo al resolver una tarea: HECHA o DESCARTADA
    private CanalContacto canal;

    @Size(max = 300, message = "La nota no puede superar los 300 caracteres")
    private String nota;
}
