package com.summit.backend.repository;

import com.summit.backend.model.PerfilSocio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PerfilSocioRepository extends JpaRepository<PerfilSocio, Long> {
    Optional<PerfilSocio> findByUsuarioIdUsuario(Long idUsuario);
}
