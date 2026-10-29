package com.summit.backend.mercadopago;

import com.google.gson.JsonObject;
import com.mercadopago.net.HttpMethod;
import com.mercadopago.net.MPHttpClient;
import com.mercadopago.net.MPRequest;
import com.mercadopago.net.MPResponse;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Mercado Pago de mentira para probar y mostrar el cobro con tarjeta sin cuenta (summit.pagos.tarjeta.modo=SIMULADOR).
 * Reemplaza solo la conexión del SDK: el resto del cobro es el mismo que con Mercado Pago de verdad.
 *
 * <p>El resultado sale del titular que se escribe en el formulario de prueba del panel (va en el token
 * "SIM-TITULAR-..."), con los mismos nombres que las tarjetas de prueba de Mercado Pago: APRO aprueba, CONT queda en
 * proceso (y se aprueba en la próxima consulta), FUND rechaza por fondos insuficientes, SECU por el código de
 * seguridad, EXPI por el vencimiento, CALL porque hay que autorizarlo con el banco y OTHE por otro motivo. Un pedido
 * repetido con la misma clave de idempotencia devuelve el mismo pago, como Mercado Pago. Los pagos viven en memoria.</p>
 */
public class SimuladorMercadoPago implements MPHttpClient {

    private static final Pattern CONSULTA = Pattern.compile("/v1/payments/(\\d+)$");
    private static final Map<String, String[]> RESULTADOS = Map.of(
            "APRO", new String[]{"approved", "accredited"},
            "CONT", new String[]{"in_process", "pending_contingency"},
            "FUND", new String[]{"rejected", "cc_rejected_insufficient_amount"},
            "SECU", new String[]{"rejected", "cc_rejected_bad_filled_security_code"},
            "EXPI", new String[]{"rejected", "cc_rejected_bad_filled_date"},
            "CALL", new String[]{"rejected", "cc_rejected_call_for_authorize"},
            "OTHE", new String[]{"rejected", "cc_rejected_other_reason"});

    private final Map<Long, JsonObject> pagos = new ConcurrentHashMap<>();
    private final Map<String, Long> porClave = new ConcurrentHashMap<>();
    private final AtomicLong proximoId = new AtomicLong(9_000_000_000L + System.currentTimeMillis() % 1_000_000L * 1000);

    @Override
    public MPResponse send(MPRequest pedido) {
        if (pedido.getMethod() == HttpMethod.POST && pedido.getUri().endsWith("/v1/payments")) {
            return crear(pedido);
        }
        Matcher consulta = CONSULTA.matcher(pedido.getUri());
        if (pedido.getMethod() == HttpMethod.GET && consulta.find()) {
            JsonObject pago = pagos.get(Long.valueOf(consulta.group(1)));
            if (pago == null) {
                return respuesta(404, error("Payment not found"));
            }
            // El que estaba en proceso ya se acreditó
            if ("in_process".equals(pago.get("status").getAsString())) {
                pago.addProperty("status", "approved");
                pago.addProperty("status_detail", "accredited");
            }
            return respuesta(200, pago);
        }
        return respuesta(404, error("Resource not found"));
    }

    private synchronized MPResponse crear(MPRequest pedido) {
        String clave = encabezado(pedido, "x-idempotency-key");
        if (clave != null && porClave.containsKey(clave)) {
            return respuesta(201, pagos.get(porClave.get(clave)));
        }
        JsonObject datos = pedido.getPayload();
        String token = datos.has("token") ? datos.get("token").getAsString() : "";
        String[] partes = token.split("-");
        if (partes.length < 3 || !"SIM".equals(partes[0])) {
            return respuesta(400, error("Invalid card token"));
        }
        String[] resultado = RESULTADOS.getOrDefault(partes[1].toUpperCase(), RESULTADOS.get("OTHE"));
        String medio = datos.has("payment_method_id") ? datos.get("payment_method_id").getAsString() : "visa";

        long id = proximoId.incrementAndGet();
        JsonObject pago = new JsonObject();
        pago.addProperty("id", id);
        pago.addProperty("status", resultado[0]);
        pago.addProperty("status_detail", resultado[1]);
        pago.addProperty("payment_method_id", medio);
        pago.addProperty("payment_type_id", medio.startsWith("deb") ? "debit_card" : "credit_card");
        pago.add("transaction_amount", datos.get("transaction_amount"));
        pago.add("description", datos.get("description"));
        pagos.put(id, pago);
        if (clave != null) {
            porClave.put(clave, id);
        }
        return respuesta(201, pago);
    }

    private static String encabezado(MPRequest pedido, String nombre) {
        return pedido.getHeaders() == null ? null : pedido.getHeaders().entrySet().stream()
                .filter(e -> e.getKey().equalsIgnoreCase(nombre))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }

    private static JsonObject error(String mensaje) {
        JsonObject error = new JsonObject();
        error.addProperty("message", mensaje);
        return error;
    }

    private static MPResponse respuesta(int estado, JsonObject cuerpo) {
        return new MPResponse(estado, Map.of("Content-Type", List.of("application/json")), cuerpo.toString());
    }
}
