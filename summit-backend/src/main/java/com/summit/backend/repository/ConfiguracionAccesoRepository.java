package com.summit.backend.repository;

import com.summit.backend.model.ConfiguracionAcceso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConfiguracionAccesoRepository extends JpaRepository<ConfiguracionAcceso, Long> {
}
