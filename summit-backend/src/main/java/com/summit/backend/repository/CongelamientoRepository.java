package com.summit.backend.repository;

import com.summit.backend.model.Congelamiento;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CongelamientoRepository extends JpaRepository<Congelamiento, Long> {

    // Historial de un socio, del más nuevo al más viejo
    @EntityGraph(attributePaths = "registradoPor")
    List<Congelamiento> findByUsuarioIdUsuarioOrderByDesdeDescIdCongelamientoDesc(Long idUsuario);

    // Para terminarlo: bloquea la fila para que dos pedidos a la vez no devuelvan los días dos veces
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Congelamiento c WHERE c.idCongelamiento = :idCongelamiento AND c.usuario.idUsuario = :idUsuario")
    Optional<Congelamiento> findParaActualizar(@Param("idCongelamiento") Long idCongelamiento,
                                               @Param("idUsuario") Long idUsuario);

    // El que rige en una fecha (no se superponen, así que hay uno como mucho)
    @Query("SELECT c FROM Congelamiento c WHERE c.usuario.idUsuario = :idUsuario AND c.anulado = false "
            + "AND c.desde <= :fecha AND c.hasta >= :fecha")
    Optional<Congelamiento> vigenteEl(@Param("idUsuario") Long idUsuario, @Param("fecha") LocalDate fecha);

    // Los que rigen en una fecha, como filas [idUsuario, hasta] (listado de socios)
    @Query("SELECT c.usuario.idUsuario, c.hasta FROM Congelamiento c WHERE c.anulado = false "
            + "AND c.desde <= :fecha AND c.hasta >= :fecha")
    List<Object[]> vigentesEl(@Param("fecha") LocalDate fecha);

    @Query("SELECT COUNT(c) > 0 FROM Congelamiento c WHERE c.usuario.idUsuario = :idUsuario AND c.anulado = false "
            + "AND c.desde <= :hasta AND c.hasta >= :desde")
    boolean seSuperpone(@Param("idUsuario") Long idUsuario, @Param("desde") LocalDate desde,
                        @Param("hasta") LocalDate hasta);

    // Días ya congelados en un año calendario (cuenta el año en que empieza cada congelamiento)
    @Query("SELECT COALESCE(SUM(c.diasAplicados), 0) FROM Congelamiento c WHERE c.usuario.idUsuario = :idUsuario "
            + "AND c.anulado = false AND c.desde >= :inicioAnio AND c.desde <= :finAnio")
    long diasUsadosEntre(@Param("idUsuario") Long idUsuario, @Param("inicioAnio") LocalDate inicioAnio,
                         @Param("finAnio") LocalDate finAnio);
}
