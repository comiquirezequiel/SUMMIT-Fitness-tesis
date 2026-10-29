package com.summit.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;

@Entity
@Table(name = "logs_asistencia")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LogAsistencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_log")
    private Long idLog;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "fecha_hora", nullable = false)
    private LocalDateTime fechaHora;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR) // texto, no ENUM de MySQL: agregar valores no rompe la base
    @Column(name = "tipo_evento", nullable = false, length = 20)
    private TipoEventoAsistencia tipoEvento;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR) // texto, no ENUM de MySQL: agregar valores no rompe la base
    @Column(name = "resultado", nullable = false, length = 35)
    private ResultadoAsistencia resultado;

    // Ingreso por excepción: el empleado que lo autorizó y el motivo (auditoría).
    // @JsonIgnore: en el historial solo sale el nombre (ver autorizadoPorNombre), no la cuenta completa del empleado
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "autorizado_por_id")
    private Usuario autorizadoPor;

    @Column(name = "motivo_excepcion", length = 200)
    private String motivoExcepcion;

    @JsonProperty("autorizadoPorNombre")
    public String nombreAutorizadoPor() {
        return autorizadoPor != null ? autorizadoPor.getNombreCompleto() : null;
    }

    @PrePersist
    public void prePersist() {
        if (this.fechaHora == null) this.fechaHora = LocalDateTime.now();
    }
}
