package com.summit.model.entity;

import com.summit.model.enums.EstadoLegal;
import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "certificados_medicos")
public class CertificadoMedico {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_certificado")
    private Long id;

    // RELACIÓN: Muchos Certificados pueden pertenecer a Un Usuario (Historial)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false) // Clave Foránea (FK)
    private Usuario usuario;

    @Column(name = "archivo_url", nullable = false)
    private String archivoUrl;

    @Column(name = "fecha_emision", nullable = false)
    private LocalDate fechaEmision;

    @Column(name = "fecha_vencimiento", nullable = false)
    private LocalDate fechaVencimiento;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_legal", nullable = false, length = 20)
    private EstadoLegal estadoLegal;


    
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

    public String getArchivoUrl() {
        return archivoUrl;
    }

    public void setArchivoUrl(String archivoUrl) {
        this.archivoUrl = archivoUrl;
    }

    public LocalDate getFechaEmision() {
        return fechaEmision;
    }

    public void setFechaEmision(LocalDate fechaEmision) {
        this.fechaEmision = fechaEmision;
    }

    public LocalDate getFechaVencimiento() {
        return fechaVencimiento;
    }

    public void setFechaVencimiento(LocalDate fechaVencimiento) {
        this.fechaVencimiento = fechaVencimiento;
    }

    public EstadoLegal getEstadoLegal() {
        return estadoLegal;
    }

    public void setEstadoLegal(EstadoLegal estadoLegal) {
        this.estadoLegal = estadoLegal;
    }

}