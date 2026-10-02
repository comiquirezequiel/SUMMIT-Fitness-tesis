package com.summit.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDate;

@Entity
@Table(name = "certificados_medicos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CertificadoMedico {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_certificado")
    private Long idCertificado;

    @JsonIgnore // el certificado se pide siempre por socio: no hace falta repetir sus datos
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @JsonIgnore // ruta interna en disco: el archivo se descarga por /archivo, que valida permisos
    @Column(name = "archivo_url", nullable = false, length = 255)
    private String archivoUrl;

    @Column(name = "fecha_emision", nullable = false)
    private LocalDate fechaEmision;

    @Column(name = "fecha_vencimiento", nullable = false)
    private LocalDate fechaVencimiento;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR) // texto, no ENUM de MySQL: agregar valores no rompe la base
    @Column(name = "estado_legal", nullable = false, length = 20)
    private EstadoLegalCertificado estadoLegal;

    @Column(name = "observaciones_patologias", length = 500)
    private String observacionesPatologias;
}
