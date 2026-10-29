package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;

/**
 * Descuento del catálogo que arma el dueño (ej. "Familiar 10 %", "Estudiante $ 2.000"). Se aplica sobre el precio
 * del plan, nunca sobre la matrícula. Cada socio puede tener uno habitual (PerfilSocio.descuento) y cada cobro guarda
 * el nombre y el monto descontado, así que modificarlo o borrarlo no cambia los cobros anteriores.
 */
@Entity
@Table(name = "descuentos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Descuento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_descuento")
    private Long idDescuento;

    @Column(name = "nombre", nullable = false, unique = true, length = 60)
    private String nombre;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tipo", nullable = false, length = 20)
    private TipoDescuento tipo;

    @Column(name = "valor", nullable = false, precision = 10, scale = 2)
    private BigDecimal valor;

    // Uno desactivado no se ofrece al cobrar ni se aplica como habitual
    @Column(name = "activo", nullable = false)
    @Builder.Default
    private boolean activo = true;
}
