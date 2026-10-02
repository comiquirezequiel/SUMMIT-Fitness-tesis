package com.summit.backend.repository;

import com.summit.backend.model.Plan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PlanRepository extends JpaRepository<Plan, Long> {
    List<Plan> findByActivoTrue();
    boolean existsByNombrePlan(String nombrePlan);
}
