package com.summit.config;

import com.mercadopago.MercadoPagoConfig;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration // Le dice a Spring que esta clase es de configuración inicial
public class MPConfig {

    // Lee el valor directamente de tu application.properties
    @Value("${mercadopago.access-token}")
    private String accessToken;

    @PostConstruct // Este método se ejecuta automáticamente justo después de que Spring Boot arranca
    public void inicializarMercadoPago() {
        MercadoPagoConfig.setAccessToken(accessToken);
        System.out.println("✅ SDK de Mercado Pago inicializado correctamente (v3.3.0)");
    }
}