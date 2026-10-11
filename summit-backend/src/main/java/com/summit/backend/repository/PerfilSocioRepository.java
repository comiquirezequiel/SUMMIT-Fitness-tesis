package com.summit.backend.repository;

import com.summit.backend.model.PerfilSocio;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PerfilSocioRepository extends JpaRepository<PerfilSocio, Long> {

    // Métricas: edad y género de un grupo de socios, como filas [idUsuario, fechaNacimiento, genero]
    @Query("SELECT p.usuario.idUsuario, p.fechaNacimiento, p.genero FROM PerfilSocio p WHERE p.usuario.idUsuario IN :ids")
    List<Object[]> edadYGenero(@Param("ids") Collection<Long> ids);
    Optional<PerfilSocio> findByUsuarioIdUsuario(Long idUsuario);
}
