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
        return planRepository.save(plan);
    }

    public Plan actualizar(Long id, Plan planData) {
        Plan plan = buscarPorId(id);
        if (planData.getNombrePlan() != null) plan.setNombrePlan(planData.getNombrePlan());
        if (planData.getDescripcion() != null) plan.setDescripcion(planData.getDescripcion());
        if (planData.getPrecioBase() != null) plan.setPrecioBase(planData.getPrecioBase());
        if (planData.getDuracionDias() != null) plan.setDuracionDias(planData.getDuracionDias());
        return planRepository.save(plan);
    }

    public void desactivar(Long id) {
        Plan plan = buscarPorId(id);
        plan.setActivo(false);
        planRepository.save(plan);
    }
}
