package com.summit.backend.repository;

import com.summit.backend.model.AmbienteArca;
import com.summit.backend.model.ComprobanteFiscal;
import com.summit.backend.model.EstadoComprobante;
import com.summit.backend.model.TipoComprobante;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ComprobanteFiscalRepository extends JpaRepository<ComprobanteFiscal, Long> {

    // El próximo de la cola: el más viejo de los que esperan, para respetar el orden de llegada
    Optional<ComprobanteFiscal> findFirstByAmbienteAndEstadoInAndProximoIntentoLessThanEqualOrderByIdComprobanteAsc(
            AmbienteArca ambiente, Collection<EstadoComprobante> estados, LocalDateTime hasta);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ComprobanteFiscal c WHERE c.idComprobante = :id")
    Optional<ComprobanteFiscal> findParaActualizar(@Param("id") Long id);

    // La fecha de un comprobante nunca puede ser anterior a la del último de su numeración
    @Query("SELECT MAX(c.fecha) FROM ComprobanteFiscal c WHERE c.ambiente = :ambiente AND c.cuitEmisor = :cuit"
            + " AND c.tipo = :tipo AND c.puntoVenta = :puntoVenta AND c.numero IS NOT NULL")
    LocalDate ultimaFecha(@Param("ambiente") AmbienteArca ambiente, @Param("cuit") String cuit,
                          @Param("tipo") TipoComprobante tipo, @Param("puntoVenta") Integer puntoVenta);

    List<ComprobanteFiscal> findByPagoIdPagoOrderByIdComprobanteAsc(Long idPago);

    List<ComprobanteFiscal> findByPagoIdPagoIn(Collection<Long> idsPago);

    List<ComprobanteFiscal> findByAsociado(ComprobanteFiscal factura);

    Page<ComprobanteFiscal> findByAmbiente(AmbienteArca ambiente, Pageable pageable);

    Page<ComprobanteFiscal> findByAmbienteAndEstado(AmbienteArca ambiente, EstadoComprobante estado, Pageable pageable);

    long countByAmbienteAndEstado(AmbienteArca ambiente, EstadoComprobante estado);

    // "Procesar ahora": lo que espera un reintento vuelve a la cola ya
    @Modifying(flushAutomatically = true)
    @Query("UPDATE ComprobanteFiscal c SET c.proximoIntento = :ahora WHERE c.ambiente = :ambiente AND c.estado IN :estados")
    int reprogramar(@Param("ambiente") AmbienteArca ambiente, @Param("estados") Collection<EstadoComprobante> estados,
                    @Param("ahora") LocalDateTime ahora);

    Optional<ComprobanteFiscal> findFirstByAmbienteAndEstadoInOrderByIdComprobanteAsc(
            AmbienteArca ambiente, Collection<EstadoComprobante> estados);

    // Lo que el simulador de ARCA "ya autorizó" (para que no lo olvide al reiniciar el backend)
    List<ComprobanteFiscal> findByAmbienteAndCuitEmisorAndTipoAndPuntoVentaAndEstado(
            AmbienteArca ambiente, String cuit, TipoComprobante tipo, Integer puntoVenta, EstadoComprobante estado);
}
