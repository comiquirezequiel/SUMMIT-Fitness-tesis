package com.summit.dto;

import java.math.BigDecimal;
import java.util.Map;

public class DashboardMetricasDTO {
    private BigDecimal ingresosDelMes;
    private long totalSociosActivos;
    private double porcentajeRetencion;
    private Map<Integer, Long> horasPico; // Hora del día -> Cantidad de ingresos

    // --- NUEVAS MÉTRICAS ---
    private long solicitudesDeBaja;
    private long nuevosEsteMes;
    private BigDecimal ingresosDeHoy;

    // Getters y Setters...
    public BigDecimal getIngresosDelMes() { return ingresosDelMes; }
    
    public void setIngresosDelMes(BigDecimal ingresosDelMes) { this.ingresosDelMes = ingresosDelMes; }
    
    public long getTotalSociosActivos() { return totalSociosActivos; }
    
    public void setTotalSociosActivos(long totalSociosActivos) { this.totalSociosActivos = totalSociosActivos; }
    
    public double getPorcentajeRetencion() { return porcentajeRetencion; }
    
    public void setPorcentajeRetencion(double porcentajeRetencion) { this.porcentajeRetencion = porcentajeRetencion; }
    
    public Map<Integer, Long> getHorasPico() { return horasPico; }
    
    public void setHorasPico(Map<Integer, Long> horasPico) { this.horasPico = horasPico; }

        public long getSolicitudesDeBaja() {
        return solicitudesDeBaja;
    }

    public void setSolicitudesDeBaja(long solicitudesDeBaja) {
        this.solicitudesDeBaja = solicitudesDeBaja;
    }

    public long getNuevosEsteMes() {
        return nuevosEsteMes;
    }

    public void setNuevosEsteMes(long nuevosEsteMes) {
        this.nuevosEsteMes = nuevosEsteMes;
    }

    public BigDecimal getIngresosDeHoy() {
        return ingresosDeHoy;
    }

    public void setIngresosDeHoy(BigDecimal ingresosDeHoy) {
        this.ingresosDeHoy = ingresosDeHoy;
    }

}