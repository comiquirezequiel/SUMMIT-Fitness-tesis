package com.summit.backend.service;

import com.summit.backend.model.Plan;
import com.summit.backend.model.Suscripcion;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.PlanRepository;
import com.summit.backend.repository.SuscripcionRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Servicio de suscripciones.
 * Asigna planes a socios y controla vencimientos.
 */
@Service
@RequiredArgsConstructor
public class SuscripcionService {

    private final SuscripcionRepository suscripcionRepository;
    private final UsuarioRepository usuarioRepository;
    private final PlanRepository planRepository;

    public List<Suscripcion> listarPorSocio(Long idUsuario) {
        return suscripcionRepository.findByUsuarioIdUsuario(idUsuario);
    }

    /**
     * Extiende o crea una suscripción al registrar un pago.
     * Si tiene una activa, suma días al vencimiento actual.
     * Si no tiene o está vencida, empieza desde hoy.
     */
    public Suscripcion extenderOcrearSuscripcion(Usuario usuario, Plan plan) {
        Suscripcion sub = suscripcionRepository
                .findFirstByUsuarioIdUsuarioAndActivaTrueOrderByFechaVencimientoDesc(usuario.getIdUsuario())
                .orElse(null);

        LocalDate hoy = LocalDate.now();
        LocalDate nuevaFechaVencimiento;
        LocalDate nuevaFechaInicio;

        if (sub != null && !sub.getFechaVencimiento().isBefore(hoy)) {
            // Extiende la actual
            nuevaFechaInicio = sub.getFechaInicio();
            nuevaFechaVencimiento = sub.getFechaVencimiento().plusDays(plan.getDuracionDias());
            
            sub.setPlan(plan);
            sub.setFechaVencimiento(nuevaFechaVencimiento);
            return suscripcionRepository.save(sub);
        } else {
            // Crea una nueva o estaba vencida
            nuevaFechaInicio = hoy;
            nuevaFechaVencimiento = hoy.plusDays(plan.getDuracionDias());
            
            Suscripcion nuevaSub = Suscripcion.builder()
                    .usuario(usuario)
                    .plan(plan)
                    .fechaInicio(nuevaFechaInicio)
                    .fechaVencimiento(nuevaFechaVencimiento)
                    .activa(true)
                    .build();
            return suscripcionRepository.save(nuevaSub);
        }
    }

    /**
     * Crea o extiende una suscripción por IDs (usado por SuscripcionController).
     */
    public Suscripcion crearSuscripcion(Long idUsuario, Long idPlan) {
        Usuario usuario = usuarioRepository.findById(idUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        Plan plan = planRepository.findById(idPlan)
                .orElseThrow(() -> new RuntimeException("Plan no encontrado"));
        return extenderOcrearSuscripcion(usuario, plan);
    }

    /**
     * Verifica si el socio tiene una suscripción activa con cuota al día.
     */
    public boolean verificarCuotaAlDia(Long idUsuario) {
        return suscripcionRepository
                .findFirstByUsuarioIdUsuarioAndActivaTrueOrderByFechaVencimientoDesc(idUsuario)
                .filter(s -> !s.getFechaVencimiento().isBefore(LocalDate.now()))
                .isPresent();
    }
}
