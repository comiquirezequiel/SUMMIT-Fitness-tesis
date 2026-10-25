package com.summit.backend.repository;

import com.summit.backend.model.RecuperacionPassword;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface RecuperacionPasswordRepository extends JpaRepository<RecuperacionPassword, Long> {

    @EntityGraph(attributePaths = "usuario")
    Optional<RecuperacionPassword> findByHashToken(String hashToken);

    // El último pedido de un usuario (para no mandar mails seguidos)
    Optional<RecuperacionPassword> findFirstByUsuarioIdUsuarioOrderByCreadaDesc(Long idUsuario);

    // Un pedido nuevo (o un cambio de contraseña) anula los links anteriores que no se usaron
    @Modifying
    @Query("UPDATE RecuperacionPassword r SET r.usada = :ahora WHERE r.usuario.idUsuario = :idUsuario AND r.usada IS NULL")
    int anularPendientes(@Param("idUsuario") Long idUsuario, @Param("ahora") LocalDateTime ahora);

    @Modifying
    @Query("DELETE FROM RecuperacionPassword r WHERE r.creada < :limite")
    int borrarAnterioresA(@Param("limite") LocalDateTime limite);
}
