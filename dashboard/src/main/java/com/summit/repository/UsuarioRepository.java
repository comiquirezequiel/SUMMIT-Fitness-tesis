package com.summit.repository;

import com.summit.model.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository // Le indica a Spring que este es un componente de acceso a datos
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    // Spring Boot lee "findBy" y el atributo "Dni" y arma un: 
    // SELECT * FROM usuarios WHERE dni = ?
    Optional<Usuario> findByDni(String dni);

    // Ideal para cuando implementemos el Login y los tokens JWT
    Optional<Usuario> findByEmail(String email);
    
    // Podemos buscar todos los usuarios activos, por ejemplo, para una métrica del dashboard
    long countByEstado(com.summit.model.enums.EstadoUsuario estado);

    // NUEVO: Cuenta cuántos usuarios se registraron en un rango de fechas
    long countByFechaRegistroBetween(LocalDateTime inicio, LocalDateTime fin);
}