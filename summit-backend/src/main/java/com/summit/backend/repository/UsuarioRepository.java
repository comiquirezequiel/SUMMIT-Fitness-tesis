package com.summit.backend.repository;

import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByEmail(String email);
    Optional<Usuario> findByDni(String dni);
    boolean existsByEmail(String email);
    boolean existsByDni(String dni);
    List<Usuario> findByRol(Rol rol);
    boolean existsByRol(Rol rol);
    long countByRol(Rol rol);
    long countByRolAndEstado(Rol rol, EstadoUsuario estado);

    /** Con ese estado y una membresía activa que vence desde esa fecha en adelante (al día, contando la gracia). */
    @Query("SELECT COUNT(u) FROM Usuario u WHERE u.rol = :rol AND u.estado = :estado AND EXISTS ("
            + "SELECT 1 FROM Suscripcion s WHERE s.usuario = u AND s.activa = true AND s.fechaVencimiento >= :venceDesde)")
    long countConMembresiaAlDia(@Param("rol") Rol rol, @Param("estado") EstadoUsuario estado,
                                @Param("venceDesde") LocalDate venceDesde);
    long countByRolAndFechaCreacionGreaterThanEqual(Rol rol, LocalDateTime desde);
    long countByRolAndFechaCreacionGreaterThanEqualAndFechaCreacionLessThan(Rol rol, LocalDateTime desde, LocalDateTime hasta);
}
