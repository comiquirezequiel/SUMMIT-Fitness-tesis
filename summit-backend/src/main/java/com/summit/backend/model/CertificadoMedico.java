package com.summit.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDate;
import java.time.LocalDateTime;

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

    // Resumen de la condición del socio que propuso el asistente de IA y confirmó el personal
    // Columna nueva resumen_ia (VARCHAR(1000), puede ser NULL): Hibernate la creó sola al arrancar
    // (ddl-auto=update), sin borrar ni modificar los datos existentes. Se guarda SOLO cuando una persona
    // confirma la lectura (al subir el certificado o con el PATCH del controlador).
    @Column(name = "resumen_ia", length = 1000)
    private String resumenIa;

    // Revisión manual: por qué se rechazó (ilegible, no es del socio, falso...) y quién lo revisó, y cuándo.
    // Un certificado rechazado deja de habilitar el ingreso aunque no esté vencido.
    @Column(name = "motivo_rechazo", length = 200)
    private String motivoRechazo;

    @JsonIgnore // en la ficha solo sale el nombre (ver revisadoPorNombre), no la cuenta completa del empleado
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revisado_por_id")
    private Usuario revisadoPor;

    @Column(name = "fecha_revision")
    private LocalDateTime fechaRevision;

    @JsonProperty("revisadoPorNombre")
    public String nombreRevisadoPor() {
        return revisadoPor != null ? revisadoPor.getNombreCompleto() : null;
    }
}
