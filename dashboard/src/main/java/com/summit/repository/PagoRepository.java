package com.summit.repository;

import com.summit.model.entity.Pago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Repository
public interface PagoRepository extends JpaRepository<Pago, Long> {

    // Consulta personalizada para el Dashboard Gerencial:
    // Suma todo el dinero ingresado entre dos fechas exactas (ej. del 1 al 31 del mes).
    @Query("SELECT SUM(p.montoAbonado) FROM Pago p WHERE p.fechaPago >= :inicio AND p.fechaPago <= :fin")
    BigDecimal calcularIngresosDelMes(@Param("inicio") LocalDateTime inicio, @Param("fin") LocalDateTime fin);

    // Cuenta cuántos pagos se hicieron con un método específico (para ver si se usa más MercadoPago o Efectivo)
    long countByMetodoPago(com.summit.model.enums.MetodoPago metodoPago);

    // NUEVO: Suma estricta de hoy
    @Query("SELECT SUM(p.montoAbonado) FROM Pago p WHERE p.fechaPago BETWEEN :inicioDia AND :finDia AND p.estadoPago = 'APROBADO'")
    BigDecimal calcularIngresosDelDia(@Param("inicioDia") LocalDateTime inicioDia, @Param("finDia") LocalDateTime finDia);
}