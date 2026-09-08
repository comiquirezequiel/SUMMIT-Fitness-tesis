package com.summit.repository;

import com.summit.model.entity.Plan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlanRepository extends JpaRepository<Plan, Long> {
    // Por ahora no necesitamos métodos personalizados (Queries), 
    // con los que trae JpaRepository por defecto (findById, findAll) nos alcanza.
}