package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;

/**
 * Datos fiscales del dueño del gimnasio para la factura electrónica (fila única, id 1). Van aparte de DatosGimnasio,
 * que es información pública. Cada comprobante copia los del momento en que se emitió.
 */
@Entity
@Table(name = "datos_fiscales")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DatosFiscales {

    @Id
    @Column(name = "id_datos")
    private Long idDatos;

    @Column(name = "cuit", length = 11)
    private String cuit;                    // 11 dígitos, sin guiones

    @Column(name = "razon_social", length = 100)
    private String razonSocial;             // nombre del dueño o de la sociedad, como figura en ARCA

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "condicion_iva", length = 30)
    private CondicionIva condicionIva;

    @Column(name = "ingresos_brutos", length = 30)
    private String ingresosBrutos;          // número de inscripción, o "Exento" / "Convenio Multilateral"

    @Column(name = "inicio_actividades")
    private LocalDate inicioActividades;

    @Column(name = "domicilio_comercial", length = 150)
    private String domicilioComercial;      // el del local, como está declarado en ARCA

    @Column(name = "punto_venta")
    private Integer puntoVenta;             // el punto de venta "web services" dado de alta en ARCA

    // Con true, la factura sale a nombre del socio con su DNI; con false, "A consumidor final" sin identificar (las
    // cuotas están muy por debajo del monto desde el que es obligatorio identificarlo)
    @Column(name = "identificar_socio", nullable = false)
    private boolean identificarSocio;
}
