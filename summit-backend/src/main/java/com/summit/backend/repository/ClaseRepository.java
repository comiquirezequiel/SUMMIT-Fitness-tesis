package com.summit.backend.repository;

import com.summit.backend.model.Clase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClaseRepository extends JpaRepository<Clase, Long> {
    List<Clase> findByActivaTrue();
}
