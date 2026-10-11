package com.summit.backend.repository;

import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByEmail(String email);
    Optional<Usuario> findByDni(String dni);
    boolean existsByEmail(String email);
    boolean existsByDni(String dni);
    List<Usuario> findByRol(Rol rol);
    boolean existsByRol(Rol rol);
    long countByRol(Rol rol);
    long countByRolAndEstado(Rol rol, EstadoUsuario estado);
    long countByRolAndFechaCreacionGreaterThanEqual(Rol rol, LocalDateTime desde);
    long countByRolAndFechaCreacionGreaterThanEqualAndFechaCreacionLessThan(Rol rol, LocalDateTime desde, LocalDateTime hasta);
}
