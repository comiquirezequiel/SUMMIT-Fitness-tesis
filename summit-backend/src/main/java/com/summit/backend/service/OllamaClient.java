package com.summit.backend.service;

// Jackson: la librería de JSON que ya trae Spring Boot. JsonNode representa un JSON ya leído (un árbol de nodos)
// y ObjectMapper convierte entre objetos Java y texto JSON. No hizo falta agregar ninguna dependencia nueva.
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
// Lombok: @Slf4j genera automáticamente el campo "log" para escribir mensajes en la consola del servidor.
import lombok.extern.slf4j.Slf4j;
// @Value: lee valores de application.properties (summit.ia.*) y los inyecta en el constructor.
import org.springframework.beans.factory.annotation.Value;
// @Service: le indica a Spring que esta clase es un componente que debe crear una sola vez y compartir.
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.ConnectException;
import java.net.URI;
// HttpClient: el cliente HTTP que viene incluido en Java 11+. Se eligió en lugar de librerías externas
// (RestTemplate, WebClient, OkHttp) porque permite fijar tiempos de espera de forma simple y no suma dependencias.
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
// Semaphore: una "barrera" de concurrencia que limita cuántos hilos pueden entrar a la vez a una sección de código.
import java.util.concurrent.Semaphore;

/**
 * ADAPTADOR HACIA LA IA LOCAL (Ollama).
 *
 * <p>
 * <b>Qué es Ollama:</b> un programa que corre en la misma computadora del
 * gimnasio y "sirve" modelos de
 * lenguaje (en nuestro caso gemma4:12b) a través de una API HTTP en
 * http://localhost:11434. El backend le
 * habla igual que un navegador le habla a un servidor web: le manda un pedido
 * JSON y recibe una respuesta JSON.
 * </p>
 *
 * <p>
 * <b>Por qué una clase aparte:</b> toda la comunicación con la IA está
 * concentrada acá (patrón "adaptador").
 * El resto del sistema (AsistenteIaService) no sabe que existe Ollama: solo
 * llama a {@link #generarJson}.
 * Si mañana se cambia de proveedor o de forma de conexión, se modifica
 * únicamente esta clase.
 * </p>
 *
 * <p>
 * <b>Por qué local:</b> los certificados médicos son datos de salud (Ley
 * 25.326). Al usar un modelo que corre
 * en el propio equipo, esos datos nunca se envían a servicios externos ni
 * requieren internet.
 * </p>
 *
 * <p>
 * <b>Tolerancia a fallos:</b> si Ollama no está corriendo, cualquier error se
 * convierte en
 * {@link IaNoDisponibleException}, que el controlador traduce a HTTP 503 con un
 * mensaje claro.
 * El resto del sistema (socios, caja, clases...) sigue funcionando normalmente.
 * </p>
 */
@Service
@Slf4j
public class OllamaClient {

    // Convierte el pedido (un Map de Java) a texto JSON y lee la respuesta de
    // Ollama. Lo provee Spring.
    private final ObjectMapper mapper;
    // Dirección del servidor de Ollama (summit.ia.url). Por defecto
    // http://localhost:11434.
    private final String url;
    // Nombre del modelo a usar (summit.ia.modelo), por ejemplo "gemma4:12b". Se
    // puede cambiar sin tocar código.
    private final String modelo;
    // Tiempo máximo de espera de una respuesta (summit.ia.timeout-segundos). Un
    // análisis de imagen tarda 20-60 s,
    // por eso el límite es generoso (180 s): si se supera, se avisa en lugar de
    // dejar al usuario esperando para siempre.
    private final Duration timeout;
    // Interruptor general (summit.ia.habilitada): permite apagar la IA desde la
    // configuración sin recompilar.
    private final boolean habilitada;
    // Cliente HTTP reutilizable. connectTimeout(3 s): si Ollama no está corriendo,
    // la conexión falla rápido
    // (3 segundos) en lugar de esperar el timeout completo de la respuesta.
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    // Un pedido por vez: el modelo ocupa casi toda la memoria de la placa de video
    // Semaphore(1) = un solo "permiso". Dos análisis simultáneos competirían por la
    // misma GPU (8 GB) y
    // podrían volverse muy lentos o fallar por falta de memoria. Con un permiso, el
    // segundo pedido recibe un
    // aviso inmediato ("está procesando otro pedido") en lugar de quedar trabado.
    private final Semaphore turno = new Semaphore(1);

    /**
     * Spring llama a este constructor automáticamente y le pasa los valores de
     * application.properties.
     * La sintaxis "${clave:valorPorDefecto}" usa el valor por defecto si la
     * propiedad no está definida.
     */
    public OllamaClient(ObjectMapper mapper,
            @Value("${summit.ia.url}") String url,
            @Value("${summit.ia.modelo}") String modelo,
            @Value("${summit.ia.timeout-segundos:180}") long timeoutSegundos,
            @Value("${summit.ia.habilitada:true}") boolean habilitada) {
        this.mapper = mapper;
        // Se quita la barra final (si la hay) para que al concatenar "/api/generate" no
        // quede "//api/generate".
        this.url = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
        this.modelo = modelo;
        this.timeout = Duration.ofSeconds(timeoutSegundos);
        this.habilitada = habilitada;
    }

    /**
     * Resultado de consultar si la IA se puede usar.
     * Es un "record" (Java 16+): una clase inmutable que solo transporta datos;
     * Java genera solo
     * el constructor, los getters, equals y toString. Se envía tal cual al frontend
     * como JSON:
     * {"disponible": true, "modelo": "gemma4:12b", "motivo": null}.
     */
    public record Estado(boolean disponible, String modelo, String motivo) {
    }

    /**
     * Excepción propia para cualquier problema con la IA (Ollama apagado, modelo
     * faltante, demora, respuesta rota).
     * Extiende RuntimeException para no obligar a declararla en cada método. Tener
     * un tipo propio permite que
     * el controlador la distinga de un error de datos (400) y responda 503
     * "servicio no disponible".
     */
    public static class IaNoDisponibleException extends RuntimeException {
        public IaNoDisponibleException(String mensaje) {
            super(mensaje);
        }
    }

    // Lo usa AsistenteIaService para informar en la respuesta qué modelo hizo el
    // análisis.
    public String getModelo() {
        return modelo;
    }

    /**
     * Si el asistente se puede usar: Ollama responde y tiene descargado el modelo
     * configurado.
     *
     * <p>
     * La página lo consulta una vez para decidir si habilita los botones de IA y,
     * si no,
     * mostrar el motivo (por ejemplo "Ollama no está corriendo").
     * </p>
     */
    public Estado estado() {
        // 1) Interruptor de configuración apagado: ni siquiera se intenta conectar.
        if (!habilitada) {
            return new Estado(false, modelo, "El asistente de IA está deshabilitado en la configuración");
        }
        try {
            // 2) GET /api/tags es el endpoint de Ollama que lista los modelos descargados.
            // Timeout corto (3 s) porque es una consulta liviana.
            HttpRequest pedido = HttpRequest.newBuilder(URI.create(url + "/api/tags"))
                    .timeout(Duration.ofSeconds(3)).GET().build();
            // La respuesta tiene la forma {"models": [{"name": "gemma4:12b", "model":
            // "gemma4:12b", ...}, ...]}
            JsonNode modelos = mapper.readTree(http.send(pedido, HttpResponse.BodyHandlers.ofString()).body())
                    .path("models");
            // 3) Se busca el modelo configurado en la lista (se compara "name" y "model"
            // porque según la versión
            // de Ollama puede venir en uno u otro campo).
            for (JsonNode m : modelos) {
                if (modelo.equals(m.path("name").asText()) || modelo.equals(m.path("model").asText())) {
                    return new Estado(true, modelo, null);
                }
            }
            // 4) Ollama está, pero el modelo no: se indica el comando exacto para
            // descargarlo.
            return new Estado(false, modelo, "Falta descargar el modelo " + modelo + " (ollama pull " + modelo + ")");
        } catch (IOException e) {
            // No se pudo conectar: lo más común es que no se haya ejecutado "ollama serve".
            return new Estado(false, modelo, "Ollama no está corriendo en " + url);
        } catch (InterruptedException e) {
            // Buena práctica de Java: si un hilo es interrumpido, se vuelve a marcar la
            // interrupción
            // para que quien lo administra (el servidor) se entere.
            Thread.currentThread().interrupt();
            return new Estado(false, modelo, "Se interrumpió la consulta a Ollama");
        }
    }

    /**
     * Le pide al modelo una respuesta JSON que cumpla el esquema (salida
     * estructurada de Ollama).
     *
     * <p>
     * <b>Salida estructurada:</b> además de las instrucciones (prompt), se le envía
     * a Ollama un JSON Schema
     * en el campo "format". Ollama restringe la generación del modelo token por
     * token para que la respuesta
     * cumpla ese esquema (técnica de "decodificación restringida"). Así la
     * respuesta SIEMPRE es un JSON
     * con los campos esperados y, si el esquema tiene una lista cerrada ("enum"),
     * el modelo no puede
     * inventar valores fuera de ella.
     * </p>
     *
     * @param prompt   las instrucciones en lenguaje natural (las arma
     *                 AsistenteIaService)
     * @param imagenes PNG o JPG en base64; vacía si el pedido es solo texto
     * @param esquema  el JSON Schema que debe cumplir la respuesta
     * @return la respuesta del modelo ya convertida en un árbol JSON listo para
     *         leer
     */
    public JsonNode generarJson(String prompt, List<String> imagenes, Map<String, Object> esquema) {
        if (!habilitada) {
            throw new IaNoDisponibleException("El asistente de IA está deshabilitado en la configuración");
        }
        // tryAcquire() (y no acquire()): si ya hay otro análisis en curso, NO se
        // espera; se avisa enseguida.
        // Esperar dejaría hilos del servidor bloqueados hasta 3 minutos.
        if (!turno.tryAcquire()) {
            throw new IaNoDisponibleException(
                    "El asistente de IA está procesando otro pedido: probá de nuevo en unos segundos");
        }
        try {
            // Cuerpo del pedido a Ollama. Se usa LinkedHashMap para conservar el orden de
            // las claves (solo legibilidad).
            Map<String, Object> cuerpo = new LinkedHashMap<>();
            cuerpo.put("model", modelo); // qué modelo usar
            cuerpo.put("prompt", prompt); // las instrucciones
            if (!imagenes.isEmpty()) {
                // Para modelos con visión (gemma4 lo es), las imágenes viajan en base64 en el
                // campo "images".
                cuerpo.put("images", imagenes);
            }
            cuerpo.put("format", esquema); // el JSON Schema: obliga al modelo a responder con esa estructura
            cuerpo.put("stream", false); // la respuesta completa de una vez (no palabra por palabra)
            cuerpo.put("think", false); // sin razonamiento previo: responde mucho más rápido
            cuerpo.put("keep_alive", "10m"); // el modelo queda cargado para el próximo pedido
            // temperature 0 = respuestas deterministas: ante el mismo certificado, la misma
            // lectura.
            // Para extraer datos se quiere precisión, no creatividad.
            cuerpo.put("options", Map.of("temperature", 0));

            // POST /api/generate: el endpoint de Ollama para generar una respuesta a partir
            // de un prompt.
            HttpRequest pedido = HttpRequest.newBuilder(URI.create(url + "/api/generate"))
                    .timeout(timeout) // máximo 180 s esperando la respuesta
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(cuerpo)))
                    .build();
            // Envío sincrónico: el hilo espera la respuesta. Es lo adecuado porque el
            // usuario está esperando el resultado.
            HttpResponse<String> respuesta = http.send(pedido, HttpResponse.BodyHandlers.ofString());
            JsonNode datos = mapper.readTree(respuesta.body());
            if (respuesta.statusCode() != 200) {
                // Ollama respondió con error (por ejemplo, modelo inexistente o incompatible):
                // se registra en el log
                // del servidor para diagnóstico y se informa al usuario.
                log.warn("Ollama respondió {}: {}", respuesta.statusCode(), datos.path("error").asText());
                throw new IaNoDisponibleException("El modelo de IA no pudo procesar el pedido: "
                        + datos.path("error").asText("error desconocido"));
            }
            // Ollama devuelve {"response": "<texto>", ...}. Como pedimos formato JSON, ese
            // texto ES un JSON:
            // se lo vuelve a leer para devolver un árbol de nodos que AsistenteIaService
            // puede recorrer.
            return mapper.readTree(datos.path("response").asText());
        } catch (HttpTimeoutException e) {
            // Se superó summit.ia.timeout-segundos.
            throw new IaNoDisponibleException("El asistente de IA tardó demasiado en responder");
        } catch (ConnectException e) {
            // No hay nada escuchando en el puerto de Ollama.
            throw new IaNoDisponibleException("Ollama no está corriendo en " + url);
        } catch (IOException e) {
            // Cualquier otro problema de red o un JSON que no se pudo leer.
            log.warn("Error al hablar con Ollama", e);
            throw new IaNoDisponibleException("La respuesta del asistente de IA no se pudo leer: probá de nuevo");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IaNoDisponibleException("Se interrumpió el pedido al asistente de IA");
        } finally {
            // finally se ejecuta SIEMPRE (haya error o no): garantiza que el permiso se
            // libere y que el
            // asistente no quede "ocupado para siempre" después de un fallo.
            turno.release();
        }
    }
}
