package com.summit.backend.repository;

import com.summit.backend.model.Plan;
import org.springframework.data.jpa.repository.JpaRepository;


public interface PlanRepository extends JpaRepository<Plan, Long> {
    boolean existsByNombrePlan(String nombrePlan);
}
