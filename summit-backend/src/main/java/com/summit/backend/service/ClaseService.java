package com.summit.backend.service;

import com.summit.backend.model.Clase;
import com.summit.backend.model.ClaseHorario;
import com.summit.backend.repository.ClaseHorarioRepository;
import com.summit.backend.repository.ClaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Servicio de clases grupales.
 * Gestiona clases, horarios y cupos.
 */
@Service
@RequiredArgsConstructor
public class ClaseService {

    private final ClaseRepository claseRepository;
    private final ClaseHorarioRepository claseHorarioRepository;

    public List<Clase> listar() {
        return claseRepository.findAll();
    }

    public Clase buscarPorId(Long id) {
        return claseRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Clase no encontrada con ID: " + id));
    }

    public Clase crear(Clase clase) {
        return claseRepository.save(clase);
    }

    public Clase actualizar(Long id, Clase data) {
        Clase clase = buscarPorId(id);
        if (data.getNombre() != null) clase.setNombre(data.getNombre());
        if (data.getDescripcion() != null) clase.setDescripcion(data.getDescripcion());
        if (data.getCapacidadMaxima() != null) clase.setCapacidadMaxima(data.getCapacidadMaxima());
        return claseRepository.save(clase);
    }

    /**
     * Agrega un horario semanal a una clase.
     */
    public ClaseHorario agregarHorario(Long idClase, ClaseHorario horario) {
        Clase clase = buscarPorId(idClase);
        horario.setClase(clase);
        return claseHorarioRepository.save(horario);
    }

    public List<ClaseHorario> listarHorarios(Long idClase) {
        return claseHorarioRepository.findByClaseIdClase(idClase);
    }

    public void desactivar(Long id) {
        Clase clase = buscarPorId(id);
        clase.setActiva(false);
        claseRepository.save(clase);
    }
}
