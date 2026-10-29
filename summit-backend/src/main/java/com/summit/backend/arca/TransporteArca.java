package com.summit.backend.arca;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Manda los mensajes SOAP a ARCA por HTTPS, o al simulador cuando la dirección es "simulador:..." (ambiente
 * SIMULADOR): así el simulador recibe exactamente los mismos mensajes que ARCA.
 */
@Component
public class TransporteArca {

    private final SimuladorArca simulador;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public TransporteArca(SimuladorArca simulador) {
        this.simulador = simulador;
    }

    /**
     * Devuelve la respuesta, también si es un error SOAP (que llega con HTTP 500).
     *
     * @throws IOException si no hubo respuesta (sin conexión, tiempo agotado) o llegó otra cosa
     */
    public String enviar(String url, String soapAction, String xml) throws IOException {
        if (url.startsWith("simulador:")) {
            return simulador.atender(url, soapAction, xml);
        }
        HttpRequest pedido = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "text/xml; charset=utf-8")
                .header("SOAPAction", "\"" + soapAction + "\"")
                .POST(HttpRequest.BodyPublishers.ofString(xml, StandardCharsets.UTF_8))
                .build();
        try {
            HttpResponse<String> respuesta = http.send(pedido, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (respuesta.statusCode() != 200 && respuesta.statusCode() != 500) {
                throw new IOException("ARCA respondió HTTP " + respuesta.statusCode());
            }
            return respuesta.body();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Se interrumpió el envío a ARCA", e);
        }
    }
}
