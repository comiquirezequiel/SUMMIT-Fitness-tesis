package com.summit.backend.repository;

import com.summit.backend.model.Plan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlanRepository extends JpaRepository<Plan, Long> {
    List<Plan> findByActivoTrue();
    boolean existsByNombrePlan(String nombrePlan);
}
