package com.summit.backend.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.ConnectException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * ADAPTADOR HACIA MERCADO PAGO (débito automático mensual con "Suscripciones").
 *
 * <p>Mismo patrón que {@link OllamaClient}: es la ÚNICA clase que habla con Mercado Pago. Usa el HttpClient de
 * Java y Jackson (sin librerías nuevas) contra la API REST https://api.mercadopago.com:</p>
 * <ul>
 *   <li>POST /preapproval: crea la suscripción del socio. Queda "pending" hasta que el socio la autoriza
 *       en Mercado Pago eligiendo con qué pagar (dinero en cuenta o cualquier tarjeta de débito, crédito o prepaga).</li>
 *   <li>GET /preapproval/{id}: estado de la suscripción (pending, authorized, paused, cancelled).</li>
 *   <li>PUT /preapproval/{id}: darla de baja o cambiar el monto.</li>
 *   <li>GET /authorized_payments/search: los cobros mensuales que hizo Mercado Pago.</li>
 * </ul>
 *
 * <p><b>Credencial:</b> el access token es privado (permite cobrar en nombre del gimnasio): se carga desde la
 * variable de entorno MP_ACCESS_TOKEN y nunca se escribe en el código ni en el repositorio. Sin credencial, el
 * débito automático queda apagado y el resto del sistema funciona igual (como la IA sin Ollama).</p>
 */
@Service
@Slf4j
public class MercadoPagoClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(20);
    // Mercado Pago acepta como máximo 10 resultados por página en /authorized_payments/search
    private static final int POR_PAGINA = 10;

    private final ObjectMapper mapper;
    private final String url;
    private final String accessToken;
    // Adónde vuelve el socio después de autorizar en Mercado Pago (tiene que ser una dirección https)
    private final String backUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public MercadoPagoClient(ObjectMapper mapper,
            @Value("${summit.pagos.mp.url:https://api.mercadopago.com}") String url,
            @Value("${summit.pagos.mp.access-token:}") String accessToken,
            @Value("${summit.pagos.mp.back-url:https://www.mercadopago.com.ar}") String backUrl) {
        this.mapper = mapper;
        this.url = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
        this.accessToken = accessToken == null ? "" : accessToken.trim();
        this.backUrl = backUrl;
    }

    /**
     * Cualquier problema con Mercado Pago (sin credencial, sin internet, credencial rechazada, demora).
     * El controlador la traduce a HTTP 503 "servicio no disponible".
     */
    public static class MercadoPagoNoDisponibleException extends RuntimeException {
        public MercadoPagoNoDisponibleException(String mensaje) {
            super(mensaje);
        }
    }

    public boolean habilitado() {
        return !accessToken.isEmpty();
    }

    /**
     * Crea la suscripción mensual del socio. Devuelve el JSON de Mercado Pago: "id" (de la suscripción) e
     * "init_point" (el link donde el socio la autoriza).
     *
     * @param referencia identifica la adhesión en SUMMIT; también se usa como clave de idempotencia
     *                   (si el pedido se repite por un corte de conexión, Mercado Pago no crea dos suscripciones)
     */
    public JsonNode crearSuscripcion(String emailPagador, String motivo, String referencia, BigDecimal monto, int meses) {
        Map<String, Object> recurrencia = new LinkedHashMap<>();
        recurrencia.put("frequency", meses);
        recurrencia.put("frequency_type", "months");
        recurrencia.put("transaction_amount", monto);
        recurrencia.put("currency_id", "ARS");

        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("reason", motivo);
        cuerpo.put("external_reference", referencia);
        cuerpo.put("payer_email", emailPagador);
        cuerpo.put("auto_recurring", recurrencia);
        cuerpo.put("back_url", backUrl);
        cuerpo.put("status", "pending"); // el socio elige el medio de pago y autoriza en el link
        return enviar("POST", "/preapproval", cuerpo, referencia);
    }

    public JsonNode obtenerSuscripcion(String idSuscripcion) {
        return enviar("GET", "/preapproval/" + codificar(idSuscripcion), null, null);
    }

    public void cancelarSuscripcion(String idSuscripcion) {
        enviar("PUT", "/preapproval/" + codificar(idSuscripcion), Map.of("status", "cancelled"), null);
    }

    public void actualizarMonto(String idSuscripcion, BigDecimal monto) {
        enviar("PUT", "/preapproval/" + codificar(idSuscripcion),
                Map.of("auto_recurring", Map.of("transaction_amount", monto, "currency_id", "ARS")), null);
    }

    /**
     * Todos los cobros ("facturas") de una suscripción, recorriendo las páginas de la búsqueda.
     * Cada uno trae "payment": {"id", "status", "status_detail"}, el monto y la fecha del débito.
     */
    public List<JsonNode> cobrosDeSuscripcion(String idSuscripcion) {
        List<JsonNode> cobros = new ArrayList<>();
        int desde = 0;
        while (true) {
            JsonNode pagina = enviar("GET", "/authorized_payments/search?preapproval_id=" + codificar(idSuscripcion)
                    + "&limit=" + POR_PAGINA + "&offset=" + desde, null, null);
            JsonNode resultados = pagina.path("results");
            resultados.forEach(cobros::add);
            int total = pagina.path("paging").path("total").asInt(cobros.size());
            desde += POR_PAGINA;
            // Tope de seguridad: 1000 cobros son más de 80 años de cuotas mensuales
            if (resultados.isEmpty() || desde >= total || desde >= 1000) {
                return cobros;
            }
        }
    }

    private JsonNode enviar(String metodo, String ruta, Object cuerpo, String claveIdempotencia) {
        if (!habilitado()) {
            throw new MercadoPagoNoDisponibleException(
                    "El débito automático no está configurado: falta la credencial de Mercado Pago (variable MP_ACCESS_TOKEN)");
        }
        try {
            HttpRequest.Builder pedido = HttpRequest.newBuilder(URI.create(url + ruta))
                    .timeout(TIMEOUT)
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Accept", "application/json");
            if (cuerpo == null) {
                pedido.method(metodo, HttpRequest.BodyPublishers.noBody());
            } else {
                pedido.header("Content-Type", "application/json")
                        .method(metodo, HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(cuerpo)));
            }
            if (claveIdempotencia != null) {
                pedido.header("X-Idempotency-Key", claveIdempotencia);
            }

            HttpResponse<String> respuesta = http.send(pedido.build(), HttpResponse.BodyHandlers.ofString());
            String texto = respuesta.body();
            JsonNode datos = texto == null || texto.isBlank() ? mapper.createObjectNode() : mapper.readTree(texto);
            int codigo = respuesta.statusCode();
            if (codigo == 401 || codigo == 403) {
                throw new MercadoPagoNoDisponibleException(
                        "Mercado Pago rechazó la credencial del gimnasio: revisá la variable MP_ACCESS_TOKEN");
            }
            if (codigo == 404) {
                throw new NoSuchElementException("Mercado Pago no encontró la suscripción");
            }
            if (codigo >= 400) {
                // Se registra el detalle técnico para diagnóstico; al usuario le llega el mensaje de Mercado Pago
                log.warn("Mercado Pago respondió {} en {} {}: {}", codigo, metodo, ruta, texto);
                throw new MercadoPagoNoDisponibleException("Mercado Pago no aceptó el pedido: "
                        + datos.path("message").asText("error " + codigo));
            }
            return datos;
        } catch (HttpTimeoutException e) {
            throw new MercadoPagoNoDisponibleException("Mercado Pago tardó demasiado en responder: probá de nuevo");
        } catch (ConnectException e) {
            throw new MercadoPagoNoDisponibleException("No se pudo conectar con Mercado Pago: revisá la conexión a internet");
        } catch (IOException e) {
            log.warn("Error al hablar con Mercado Pago", e);
            throw new MercadoPagoNoDisponibleException("No se pudo leer la respuesta de Mercado Pago: probá de nuevo");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new MercadoPagoNoDisponibleException("Se interrumpió el pedido a Mercado Pago");
        }
    }

    private static String codificar(String valor) {
        return URLEncoder.encode(valor, StandardCharsets.UTF_8);
    }
}
