package com.summit.backend.service;

import com.summit.backend.model.Plan;
import com.summit.backend.repository.PlanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Servicio de gestión de planes del gimnasio.
 */
@Service
@RequiredArgsConstructor
public class PlanService {

    private final PlanRepository planRepository;

    public List<Plan> listar() {
        return planRepository.findAll();
    }

    public Plan buscarPorId(Long id) {
        return planRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Plan no encontrado con ID: " + id));
    }

    public Plan crear(Plan plan) {
        plan.setVecesPorSemana(normalizarVecesPorSemana(plan.getVecesPorSemana()));
        return planRepository.save(plan);
    }

    /**
     * Actualización parcial: solo cambia los campos enviados.
     * Para pasar un plan a "pase libre" se envía vecesPorSemana = 0.
     */
    public Plan actualizar(Long id, Plan planData) {
        Plan plan = buscarPorId(id);
        if (planData.getNombrePlan() != null) plan.setNombrePlan(planData.getNombrePlan());
        if (planData.getDescripcion() != null) plan.setDescripcion(planData.getDescripcion());
        if (planData.getPrecioBase() != null) plan.setPrecioBase(planData.getPrecioBase());
        if (planData.getDuracionDias() != null) plan.setDuracionDias(planData.getDuracionDias());
        if (planData.getVecesPorSemana() != null) {
            plan.setVecesPorSemana(normalizarVecesPorSemana(planData.getVecesPorSemana()));
        }
        return planRepository.save(plan);
    }

    /**
     * null o 0 = pase libre (se guarda null); 1 a 7 = días de acceso por semana.
     */
    private Integer normalizarVecesPorSemana(Integer veces) {
        if (veces == null || veces == 0) return null;
        if (veces < 1 || veces > 7) {
            throw new IllegalArgumentException("Las veces por semana deben estar entre 1 y 7 (0 = pase libre)");
        }
        return veces;
    }

    public void desactivar(Long id) {
        Plan plan = buscarPorId(id);
        plan.setActivo(false);
        planRepository.save(plan);
    }
}
