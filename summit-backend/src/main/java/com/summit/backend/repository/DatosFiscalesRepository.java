package com.summit.backend.repository;

import com.summit.backend.model.DatosFiscales;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DatosFiscalesRepository extends JpaRepository<DatosFiscales, Long> {
}
