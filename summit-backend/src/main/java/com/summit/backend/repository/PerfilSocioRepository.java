package com.summit.backend.repository;

import com.summit.backend.model.Descuento;
import com.summit.backend.model.PerfilSocio;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PerfilSocioRepository extends JpaRepository<PerfilSocio, Long> {

    // Métricas: edad y género de un grupo de socios, como filas [idUsuario, fechaNacimiento, genero]
    @Query("SELECT p.usuario.idUsuario, p.fechaNacimiento, p.genero FROM PerfilSocio p WHERE p.usuario.idUsuario IN :ids")
    List<Object[]> edadYGenero(@Param("ids") Collection<Long> ids);
    // Con el descuento habitual en la misma consulta
    @EntityGraph(attributePaths = "descuento")
    Optional<PerfilSocio> findByUsuarioIdUsuario(Long idUsuario);

    long countByDescuentoIdDescuento(Long idDescuento);

    // Cuántos socios tienen cada descuento como habitual, como filas [idDescuento, cantidad]
    @Query("SELECT p.descuento.idDescuento, COUNT(p) FROM PerfilSocio p WHERE p.descuento IS NOT NULL GROUP BY p.descuento.idDescuento")
    List<Object[]> sociosPorDescuento();

    // Al borrar un descuento del catálogo, los socios que lo tenían como habitual se quedan sin descuento
    @Modifying
    @Query("UPDATE PerfilSocio p SET p.descuento = NULL WHERE p.descuento = :descuento")
    int quitarDescuento(@Param("descuento") Descuento descuento);

    // Fotos de un grupo de usuarios, como filas [idUsuario, fotoActualizada] (los que no tienen foto no aparecen)
    @Query("SELECT p.usuario.idUsuario, p.fotoActualizada FROM PerfilSocio p WHERE p.usuario.idUsuario IN :ids AND p.fotoUrl IS NOT NULL")
    List<Object[]> fotosDe(@Param("ids") Collection<Long> ids);
}
