package com.summit.dto;

//import java.math.BigDecimal;

public class PagoRequestDTO {
    private String token; // El token seguro de la tarjeta generado por el frontend
    private String paymentMethodId; // Ej: "visa", "master"
    private String payerEmail; // Email del pagador
    private Integer installments; // Cantidad de cuotas
    //private BigDecimal transactionAmount; // Monto a cobrar
    
    private String dniSocio; // Para saber a quién asignarle el pago en nuestra BD
    private Long planId; // El plan que está pagando

    private String payerIdentificationType;
    private String payerIdentificationNumber;

    // Getters y Setters:
    public String getPayerIdentificationType() { return payerIdentificationType; }
    public void setPayerIdentificationType(String payerIdentificationType) { this.payerIdentificationType = payerIdentificationType; }
    public String getPayerIdentificationNumber() { return payerIdentificationNumber; }
    public void setPayerIdentificationNumber(String payerIdentificationNumber) { this.payerIdentificationNumber = payerIdentificationNumber; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getPaymentMethodId() { return paymentMethodId; }
    public void setPaymentMethodId(String paymentMethodId) { this.paymentMethodId = paymentMethodId; }
    public String getPayerEmail() { return payerEmail; }
    public void setPayerEmail(String payerEmail) { this.payerEmail = payerEmail; }
    public Integer getInstallments() { return installments; }
    public void setInstallments(Integer installments) { this.installments = installments; }
    //public BigDecimal getTransactionAmount() { return transactionAmount; }
    //public void setTransactionAmount(BigDecimal transactionAmount) { this.transactionAmount = transactionAmount; }
    public String getDniSocio() { return dniSocio; }
    public void setDniSocio(String dniSocio) { this.dniSocio = dniSocio; }
    public Long getPlanId() { return planId; }
    public void setPlanId(Long planId) { this.planId = planId; }
}