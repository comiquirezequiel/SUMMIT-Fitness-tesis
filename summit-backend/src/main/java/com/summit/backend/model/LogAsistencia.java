package com.summit.backend.model;

import lombok.*;
import jakarta.persistence.*;
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
    @Column(name = "tipo_evento", nullable = false, length = 20)
    private TipoEventoAsistencia tipoEvento;

    @Enumerated(EnumType.STRING)
    @Column(name = "resultado", nullable = false, length = 35)
    private ResultadoAsistencia resultado;

    @Column(name = "latitud_socio")
    private Double latitudSocio;

    @Column(name = "longitud_socio")
    private Double longitudSocio;

    @Column(name = "distancia_metros")
    private Double distanciaMetros;

    @PrePersist
    public void prePersist() {
        if (this.fechaHora == null) this.fechaHora = LocalDateTime.now();
    }
}
