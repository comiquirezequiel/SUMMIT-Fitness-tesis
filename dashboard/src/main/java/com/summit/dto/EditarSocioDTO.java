package com.summit.dto;

public class EditarSocioDTO {
    private String nombreCompleto;
    private String email;
    private String estado; // ACTIVO, INACTIVO, PENDIENTE

    public String getNombreCompleto() { return nombreCompleto; }
    public void setNombreCompleto(String nombreCompleto) { this.nombreCompleto = nombreCompleto; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
}