package com.summit.backend.service;

import com.summit.backend.model.Ejercicio;
import com.summit.backend.model.Rutina;
import com.summit.backend.model.RutinaEjercicio;
import com.summit.backend.repository.EjercicioRepository;
import com.summit.backend.repository.RutinaEjercicioRepository;
import com.summit.backend.repository.RutinaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Servicio de rutinas de entrenamiento.
 * Gestiona la creación y asignación de rutinas con ejercicios a socios.
 */
@Service
@RequiredArgsConstructor
public class RutinaService {

    private final RutinaRepository rutinaRepository;
    private final RutinaEjercicioRepository rutinaEjercicioRepository;
    private final EjercicioRepository ejercicioRepository;
    private final com.summit.backend.repository.CertificadoMedicoRepository certificadoMedicoRepository;

    public List<Rutina> listarPorSocio(Long idSocio) {
        return rutinaRepository.findBySocioIdUsuarioAndActivaTrue(idSocio);
    }

    public Rutina buscarPorId(Long id) {
        return rutinaRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rutina no encontrada con ID: " + id));
    }

    public Rutina crear(Rutina rutina) {
        return rutinaRepository.save(rutina);
    }
    
    /**
     * RF-09: Cruce Preventivo de Patologías.
     * Retorna una lista de patologías en riesgo o lista vacía si es seguro.
     */
    public List<String> validarEjercicioContraindicado(Long idSocio, Long idEjercicio) {
        Ejercicio ejercicio = ejercicioRepository.findById(idEjercicio)
                .orElseThrow(() -> new RuntimeException("Ejercicio no encontrado"));
                
        if (ejercicio.getPatologiasContraindicadas() == null || ejercicio.getPatologiasContraindicadas().isBlank()) {
            return List.of();
        }

        return certificadoMedicoRepository.findFirstByUsuarioIdUsuarioOrderByFechaVencimientoDesc(idSocio)
                .map(cert -> {
                    if (cert.getObservacionesPatologias() == null || cert.getObservacionesPatologias().isBlank()) {
                        return List.<String>of();
                    }
                    
                    String[] patologiasSocio = cert.getObservacionesPatologias().toUpperCase().split(",");
                    String[] contraindicaciones = ejercicio.getPatologiasContraindicadas().toUpperCase().split(",");
                    
                    List<String> riesgos = new java.util.ArrayList<>();
                    for (String patologia : patologiasSocio) {
                        String p = patologia.trim();
                        if (p.isEmpty()) continue;
                        
                        for (String c : contraindicaciones) {
                            String contra = c.trim();
                            if (!contra.isEmpty() && p.contains(contra)) {
                                riesgos.add(p);
                                break;
                            }
                        }
                    }
                    return riesgos;
                }).orElse(List.of());
    }

    /**
     * Agrega un ejercicio a una rutina existente con sus parámetros (series, reps, etc.)
     */
    public RutinaEjercicio agregarEjercicio(Long idRutina, RutinaEjercicio rutinaEjercicio, boolean forzar) {
        Rutina rutina = buscarPorId(idRutina);
        
        if (!forzar && rutinaEjercicio.getEjercicio() != null) {
            List<String> riesgos = validarEjercicioContraindicado(rutina.getSocio().getIdUsuario(), rutinaEjercicio.getEjercicio().getIdEjercicio());
            if (!riesgos.isEmpty()) {
                throw new RuntimeException("Riesgo de lesión detectado. Patologías contraindicadas: " + String.join(", ", riesgos));
            }
        }
        
        rutinaEjercicio.setRutina(rutina);
        return rutinaEjercicioRepository.save(rutinaEjercicio);
    }

    public void desactivar(Long id) {
        Rutina rutina = buscarPorId(id);
        rutina.setActiva(false);
        rutinaRepository.save(rutina);
    }
}
