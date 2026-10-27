package com.summit.model.entity;

import com.summit.model.enums.ResultadoAcceso;
import com.summit.model.enums.TipoEvento;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "logs_asistencia")
public class AsistenciaLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_log")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY) //Evita traer toda la información del Usuario
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "fecha_hora", nullable = false, updatable = false)
    private LocalDateTime fechaHora;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_evento", nullable = false, length = 15)
    private TipoEvento tipoEvento;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ResultadoAcceso resultado;

    @PrePersist
    protected void onCreate() {
        this.fechaHora = LocalDateTime.now();
    }



    // Getters y Setters...

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public void setUsuario(Usuario usuario) {
        this.usuario = usuario;
    }

    public LocalDateTime getFechaHora() {
        return fechaHora;
    }

    public void setFechaHora(LocalDateTime fechaHora) {
        this.fechaHora = fechaHora;
    }

    public TipoEvento getTipoEvento() {
        return tipoEvento;
    }

    public void setTipoEvento(TipoEvento tipoEvento) {
        this.tipoEvento = tipoEvento;
    }

    public ResultadoAcceso getResultado() {
        return resultado;
    }

    public void setResultado(ResultadoAcceso resultado) {
        this.resultado = resultado;
    }


}