package com.summit.dto;

import java.time.LocalDateTime;

public class SocioListadoDTO {
    private Long id;
    private String nombreCompleto;
    private String dni;
    private String email;
    private String telefono;
    private String estado;
    private LocalDateTime fechaRegistro;
    
    // --- BANDERAS DE ALERTA PARA REACT ---
    private boolean alertaPago;
    private boolean alertaMedico;

    // GETTERS AND SETTERS
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNombreCompleto() { return nombreCompleto; }
    public void setNombreCompleto(String nombreCompleto) { this.nombreCompleto = nombreCompleto; }
    public String getDni() { return dni; }
    public void setDni(String dni) { this.dni = dni; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public LocalDateTime getFechaRegistro() { return fechaRegistro; }
    public void setFechaRegistro(LocalDateTime fechaRegistro) { this.fechaRegistro = fechaRegistro; }
    public boolean isAlertaPago() { return alertaPago; }
    public void setAlertaPago(boolean alertaPago) { this.alertaPago = alertaPago; }
    public boolean isAlertaMedico() { return alertaMedico; }
    public void setAlertaMedico(boolean alertaMedico) { this.alertaMedico = alertaMedico; }
}