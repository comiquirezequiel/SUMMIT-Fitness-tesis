package com.summit.backend.service;

import com.summit.backend.model.Ejercicio;
import com.summit.backend.model.GrupoMuscular;
import com.summit.backend.repository.EjercicioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Servicio de ejercicios.
 * Catálogo filtrable por grupo muscular para el modelo 2D interactivo.
 */
@Service
@RequiredArgsConstructor
public class EjercicioService {

    private final EjercicioRepository ejercicioRepository;

    public Page<Ejercicio> listar(Pageable pageable) {
        return ejercicioRepository.findAll(pageable);
    }

    public List<Ejercicio> buscarPorGrupoMuscular(GrupoMuscular grupo) {
        return ejercicioRepository.findByGrupoMuscular(grupo);
    }

    public Ejercicio buscarPorId(Long id) {
        return ejercicioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ejercicio no encontrado con ID: " + id));
    }

    public Ejercicio crear(Ejercicio ejercicio) {
        return ejercicioRepository.save(ejercicio);
    }

    public Ejercicio actualizar(Long id, Ejercicio data) {
        Ejercicio ejercicio = buscarPorId(id);
        if (data.getNombre() != null) ejercicio.setNombre(data.getNombre());
        if (data.getDescripcion() != null) ejercicio.setDescripcion(data.getDescripcion());
        if (data.getGrupoMuscular() != null) ejercicio.setGrupoMuscular(data.getGrupoMuscular());
        if (data.getUrlMedia() != null) ejercicio.setUrlMedia(data.getUrlMedia());
        if (data.getSvgTargetId() != null) ejercicio.setSvgTargetId(data.getSvgTargetId());
        return ejercicioRepository.save(ejercicio);
    }
}
