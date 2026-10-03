package com.summit.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Semaphore;

/**
 * Cliente del servidor local de Ollama: el modelo de IA corre en la propia máquina del gimnasio,
 * así los certificados médicos (datos de salud) no se envían a ningún servicio externo.
 * Si Ollama no está corriendo, las llamadas lanzan IaNoDisponibleException y el resto del sistema sigue igual.
 */
@Service
@Slf4j
public class OllamaClient {

    private final ObjectMapper mapper;
    private final String url;
    private final String modelo;
    private final Duration timeout;
    private final boolean habilitada;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    // Un pedido por vez: el modelo ocupa casi toda la memoria de la placa de video
    private final Semaphore turno = new Semaphore(1);

    public OllamaClient(ObjectMapper mapper,
                        @Value("${summit.ia.url}") String url,
                        @Value("${summit.ia.modelo}") String modelo,
                        @Value("${summit.ia.timeout-segundos:180}") long timeoutSegundos,
                        @Value("${summit.ia.habilitada:true}") boolean habilitada) {
        this.mapper = mapper;
        this.url = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
        this.modelo = modelo;
        this.timeout = Duration.ofSeconds(timeoutSegundos);
        this.habilitada = habilitada;
    }

    public record Estado(boolean disponible, String modelo, String motivo) {}

    public static class IaNoDisponibleException extends RuntimeException {
        public IaNoDisponibleException(String mensaje) {
            super(mensaje);
        }
    }

    public String getModelo() {
        return modelo;
    }

    /**
     * Si el asistente se puede usar: Ollama responde y tiene descargado el modelo configurado.
     */
    public Estado estado() {
        if (!habilitada) {
            return new Estado(false, modelo, "El asistente de IA está deshabilitado en la configuración");
        }
        try {
            HttpRequest pedido = HttpRequest.newBuilder(URI.create(url + "/api/tags"))
                    .timeout(Duration.ofSeconds(3)).GET().build();
            JsonNode modelos = mapper.readTree(http.send(pedido, HttpResponse.BodyHandlers.ofString()).body()).path("models");
            for (JsonNode m : modelos) {
                if (modelo.equals(m.path("name").asText()) || modelo.equals(m.path("model").asText())) {
                    return new Estado(true, modelo, null);
                }
            }
            return new Estado(false, modelo, "Falta descargar el modelo " + modelo + " (ollama pull " + modelo + ")");
        } catch (IOException e) {
            return new Estado(false, modelo, "Ollama no está corriendo en " + url);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Estado(false, modelo, "Se interrumpió la consulta a Ollama");
        }
    }

    /**
     * Le pide al modelo una respuesta JSON que cumpla el esquema (salida estructurada de Ollama).
     *
     * @param imagenes PNG o JPG en base64; vacía si el pedido es solo texto
     */
    public JsonNode generarJson(String prompt, List<String> imagenes, Map<String, Object> esquema) {
        if (!habilitada) {
            throw new IaNoDisponibleException("El asistente de IA está deshabilitado en la configuración");
        }
        if (!turno.tryAcquire()) {
            throw new IaNoDisponibleException("El asistente de IA está procesando otro pedido: probá de nuevo en unos segundos");
        }
        try {
            Map<String, Object> cuerpo = new LinkedHashMap<>();
            cuerpo.put("model", modelo);
            cuerpo.put("prompt", prompt);
            if (!imagenes.isEmpty()) {
                cuerpo.put("images", imagenes);
            }
            cuerpo.put("format", esquema);
            cuerpo.put("stream", false);
            cuerpo.put("think", false);        // sin razonamiento previo: responde mucho más rápido
            cuerpo.put("keep_alive", "10m");   // el modelo queda cargado para el próximo pedido
            cuerpo.put("options", Map.of("temperature", 0));

            HttpRequest pedido = HttpRequest.newBuilder(URI.create(url + "/api/generate"))
                    .timeout(timeout)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(cuerpo)))
                    .build();
            HttpResponse<String> respuesta = http.send(pedido, HttpResponse.BodyHandlers.ofString());
            JsonNode datos = mapper.readTree(respuesta.body());
            if (respuesta.statusCode() != 200) {
                log.warn("Ollama respondió {}: {}", respuesta.statusCode(), datos.path("error").asText());
                throw new IaNoDisponibleException("El modelo de IA no pudo procesar el pedido: " + datos.path("error").asText("error desconocido"));
            }
            return mapper.readTree(datos.path("response").asText());
        } catch (HttpTimeoutException e) {
            throw new IaNoDisponibleException("El asistente de IA tardó demasiado en responder");
        } catch (ConnectException e) {
            throw new IaNoDisponibleException("Ollama no está corriendo en " + url);
        } catch (IOException e) {
            log.warn("Error al hablar con Ollama", e);
            throw new IaNoDisponibleException("La respuesta del asistente de IA no se pudo leer: probá de nuevo");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IaNoDisponibleException("Se interrumpió el pedido al asistente de IA");
        } finally {
            turno.release();
        }
    }
}
