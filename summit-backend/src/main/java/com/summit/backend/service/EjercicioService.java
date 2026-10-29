package com.summit.backend.service;

import com.summit.backend.dto.EjercicioDTO;
import com.summit.backend.model.Ejercicio;
import com.summit.backend.model.GrupoMuscular;
import com.summit.backend.repository.EjercicioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

/**
 * Servicio de ejercicios.
 * Catálogo filtrable por grupo muscular para el modelo 2D interactivo, con las
 * contraindicaciones que usa el cruce preventivo del constructor de rutinas.
 */
@Service
@RequiredArgsConstructor
public class EjercicioService {

    private final EjercicioRepository ejercicioRepository;

    public Page<EjercicioDTO> listar(Pageable pageable) {
        return ejercicioRepository.findAll(pageable).map(EjercicioService::toDTO);
    }

    public List<EjercicioDTO> buscarPorGrupoMuscular(GrupoMuscular grupo) {
        return ejercicioRepository.findByGrupoMuscularOrderByNombre(grupo).stream()
                .map(EjercicioService::toDTO).toList();
    }

    public EjercicioDTO buscarPorId(Long id) {
        return toDTO(buscar(id));
    }

    public EjercicioDTO crear(EjercicioDTO datos) {
        String nombre = validarNombre(datos.nombre());
        if (ejercicioRepository.existsByNombreIgnoreCase(nombre)) {
            throw new IllegalArgumentException("Ya existe un ejercicio llamado " + nombre);
        }
        Ejercicio ejercicio = Ejercicio.builder()
                .nombre(nombre)
                .grupoMuscular(grupoMuscular(datos.grupoMuscular()))
                .descripcion(RutinaService.textoOpcional(datos.descripcion(), 500,
                        "La descripción no puede superar los 500 caracteres"))
                .urlMedia(RutinaService.textoOpcional(datos.urlMedia(), 255,
                        "La URL del video o imagen no puede superar los 255 caracteres"))
                .svgTargetId(RutinaService.textoOpcional(datos.svgTargetId(), 50,
                        "La zona del modelo 2D no puede superar los 50 caracteres"))
                .patologiasContraindicadas(normalizarPatologias(datos.patologiasContraindicadas()))
                .build();
        return toDTO(ejercicioRepository.save(ejercicio));
    }

    /**
     * Actualiza solo los campos que vienen; un texto vacío borra ese dato.
     */
    public EjercicioDTO actualizar(Long id, EjercicioDTO datos) {
        Ejercicio ejercicio = buscar(id);
        if (datos.nombre() != null) {
            String nombre = validarNombre(datos.nombre());
            if (ejercicioRepository.existsByNombreIgnoreCaseAndIdEjercicioNot(nombre, id)) {
                throw new IllegalArgumentException("Ya existe un ejercicio llamado " + nombre);
            }
            ejercicio.setNombre(nombre);
        }
        if (datos.grupoMuscular() != null) {
            ejercicio.setGrupoMuscular(grupoMuscular(datos.grupoMuscular()));
        }
        if (datos.descripcion() != null) {
            ejercicio.setDescripcion(RutinaService.textoOpcional(datos.descripcion(), 500,
                    "La descripción no puede superar los 500 caracteres"));
        }
        if (datos.urlMedia() != null) {
            ejercicio.setUrlMedia(RutinaService.textoOpcional(datos.urlMedia(), 255,
                    "La URL del video o imagen no puede superar los 255 caracteres"));
        }
        if (datos.svgTargetId() != null) {
            ejercicio.setSvgTargetId(RutinaService.textoOpcional(datos.svgTargetId(), 50,
                    "La zona del modelo 2D no puede superar los 50 caracteres"));
        }
        if (datos.patologiasContraindicadas() != null) {
            ejercicio.setPatologiasContraindicadas(normalizarPatologias(datos.patologiasContraindicadas()));
        }
        return toDTO(ejercicioRepository.save(ejercicio));
    }

    public static EjercicioDTO toDTO(Ejercicio ejercicio) {
        return EjercicioDTO.builder()
                .idEjercicio(ejercicio.getIdEjercicio())
                .nombre(ejercicio.getNombre())
                .descripcion(ejercicio.getDescripcion())
                .grupoMuscular(ejercicio.getGrupoMuscular() != null ? ejercicio.getGrupoMuscular().name() : null)
                .urlMedia(ejercicio.getUrlMedia())
                .svgTargetId(ejercicio.getSvgTargetId())
                .patologiasContraindicadas(ejercicio.getPatologiasContraindicadas())
                .build();
    }

    private Ejercicio buscar(Long id) {
        return ejercicioRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Ejercicio no encontrado con ID: " + id));
    }

    private static String validarNombre(String nombre) {
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("El nombre del ejercicio es obligatorio");
        }
        return RutinaService.textoOpcional(nombre, 100, "El nombre no puede superar los 100 caracteres");
    }

    private static GrupoMuscular grupoMuscular(String grupo) {
        if (grupo == null || grupo.isBlank()) {
            throw new IllegalArgumentException("Indicá el grupo muscular");
        }
        try {
            return GrupoMuscular.valueOf(grupo.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Grupo muscular inválido: " + grupo
                    + " (opciones: " + Arrays.toString(GrupoMuscular.values()) + ")");
        }
    }

    // " hernia, Rodilla ,," -> "HERNIA,RODILLA": así se cruzan igual con la ficha médica del socio
    private static String normalizarPatologias(String patologias) {
        if (patologias == null) {
            return null;
        }
        String normalizadas = Arrays.stream(patologias.split(","))
                .map(p -> p.trim().toUpperCase())
                .filter(p -> !p.isEmpty())
                .distinct()
                .collect(Collectors.joining(","));
        if (normalizadas.length() > 500) {
            throw new IllegalArgumentException("Las contraindicaciones no pueden superar los 500 caracteres");
        }
        return normalizadas.isEmpty() ? null : normalizadas;
    }
}
