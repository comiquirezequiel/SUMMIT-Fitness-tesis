package com.summit.backend.mercadopago;

import com.mercadopago.MercadoPagoConfig;
import com.mercadopago.client.common.IdentificationRequest;
import com.mercadopago.client.payment.PaymentClient;
import com.mercadopago.client.payment.PaymentCreateRequest;
import com.mercadopago.client.payment.PaymentPayerRequest;
import com.mercadopago.core.MPRequestOptions;
import com.mercadopago.exceptions.MPApiException;
import com.mercadopago.exceptions.MPException;
import com.mercadopago.net.Headers;
import com.mercadopago.net.MPHttpClient;
import com.mercadopago.net.MPRequest;
import com.mercadopago.resources.payment.Payment;
import com.summit.backend.dto.CobroConTarjetaDTO;
import com.summit.backend.model.MetodoPago;
import com.summit.backend.service.MercadoPagoClient.MercadoPagoNoDisponibleException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * Cobro con tarjeta por Mercado Pago (Checkout API), con el SDK oficial. La tarjeta se carga en el formulario de
 * Mercado Pago, que la convierte en un token: los datos de la tarjeta nunca pasan por SUMMIT. Acá se crea el pago con
 * ese token y con el monto que calculó el backend (nunca el del navegador).
 *
 * <p>Modos (summit.pagos.tarjeta.modo): APAGADO; SIMULADOR, que responde un Mercado Pago de mentira
 * ({@link SimuladorMercadoPago}) para probar y mostrar sin cuenta; y MERCADO_PAGO, con la clave pública y el access
 * token de la cuenta del gimnasio (con las de prueba, TEST-..., se cobra con las tarjetas de prueba).</p>
 */
@Component
@Slf4j
public class PasarelaTarjeta {

    public enum Modo { APAGADO, SIMULADOR, MERCADO_PAGO }

    // La clave de idempotencia del intento de cobro (el SDK pasa a minúsculas los encabezados propios)
    private static final String CLAVE = "x-idempotency-key";

    private final Modo modo;
    private final String accessToken;
    private final String publicKey;
    private final PaymentClient pagos;

    public PasarelaTarjeta(@Value("${summit.pagos.tarjeta.modo:APAGADO}") Modo modo,
                           @Value("${summit.pagos.mp.access-token:}") String accessToken,
                           @Value("${summit.pagos.mp.public-key:}") String publicKey) {
        this.accessToken = accessToken.trim();
        this.publicKey = publicKey.trim();
        if (modo == Modo.MERCADO_PAGO && (this.accessToken.isEmpty() || this.publicKey.isEmpty())) {
            log.warn("El cobro con tarjeta queda apagado: faltan MP_ACCESS_TOKEN y MP_PUBLIC_KEY");
            modo = Modo.APAGADO;
        }
        this.modo = modo;
        this.pagos = new PaymentClient(conUnaSolaClave(modo == Modo.SIMULADOR ? new SimuladorMercadoPago() : MercadoPagoConfig.getHttpClient()));
    }

    /**
     * El SDK agrega siempre su propia clave de idempotencia al azar (X-Idempotency-Key), aunque se le pase una: el
     * pedido saldría con las dos. Queda solo la del intento de cobro, así un pedido repetido no cobra dos veces.
     */
    private static MPHttpClient conUnaSolaClave(MPHttpClient conexion) {
        return pedido -> {
            if (pedido.getHeaders() == null || !pedido.getHeaders().containsKey(CLAVE)) {
                return conexion.send(pedido);
            }
            Map<String, String> encabezados = new HashMap<>(pedido.getHeaders());
            encabezados.remove(Headers.IDEMPOTENCY_KEY);
            return conexion.send(MPRequest.builder()
                    .uri(pedido.getUri())
                    .method(pedido.getMethod())
                    .headers(encabezados)
                    .payload(pedido.getPayload())
                    .queryParams(pedido.getQueryParams())
                    .accessToken(pedido.getAccessToken())
                    .connectionTimeout(pedido.getConnectionTimeout())
                    .connectionRequestTimeout(pedido.getConnectionRequestTimeout())
                    .socketTimeout(pedido.getSocketTimeout())
                    .build());
        };
    }

    /** Lo que respondió Mercado Pago: el id del pago, su estado (approved, in_process, rejected...) y el motivo. */
    public record Resultado(String id, String estado, String detalle, MetodoPago metodo) {
        public boolean aprobado() {
            return "approved".equals(estado);
        }

        public boolean rechazado() {
            return "rejected".equals(estado) || "cancelled".equals(estado);
        }
    }

    public boolean habilitada() {
        return modo != Modo.APAGADO;
    }

    public Modo modo() {
        return modo;
    }

    /** La clave pública para el formulario de tarjeta (vacía en el simulador, que usa su propio formulario). */
    public String publicKey() {
        return modo == Modo.MERCADO_PAGO ? publicKey : "";
    }

    /**
     * Crea el pago. idempotencia: si el mismo pedido se repite (por un corte de conexión), Mercado Pago devuelve el
     * mismo pago en lugar de cobrar otra vez.
     */
    public Resultado cobrar(BigDecimal monto, CobroConTarjetaDTO.Tarjeta tarjeta, String descripcion, String idempotencia) {
        PaymentCreateRequest pedido = PaymentCreateRequest.builder()
                .transactionAmount(monto)
                .token(tarjeta.token())
                .description(descripcion)
                .installments(tarjeta.cuotas() == null ? 1 : tarjeta.cuotas())
                .paymentMethodId(tarjeta.medio())
                .issuerId(tarjeta.emisor())
                .payer(PaymentPayerRequest.builder()
                        .email(tarjeta.email())
                        .identification(IdentificationRequest.builder()
                                .type(tarjeta.tipoDocumento())
                                .number(tarjeta.documento())
                                .build())
                        .build())
                .build();
        return llamar(() -> pagos.create(pedido, opciones(Map.of(CLAVE, idempotencia))));
    }

    /** Estado actual de un pago (para los que quedaron en proceso). */
    public Resultado consultar(String idPago) {
        return llamar(() -> pagos.get(Long.valueOf(idPago), opciones(Map.of())));
    }

    private interface Llamada {
        Payment hacer() throws MPException, MPApiException;
    }

    private Resultado llamar(Llamada llamada) {
        if (!habilitada()) {
            throw new MercadoPagoNoDisponibleException("El cobro con tarjeta no está configurado (MP_TARJETA)");
        }
        try {
            Payment pago = llamada.hacer();
            MetodoPago metodo = "debit_card".equals(pago.getPaymentTypeId()) ? MetodoPago.TARJETA_DEBITO : MetodoPago.TARJETA_CREDITO;
            return new Resultado(String.valueOf(pago.getId()), pago.getStatus(), pago.getStatusDetail(), metodo);
        } catch (MPApiException e) {
            // El detalle técnico queda en el log; recepción ve un mensaje que se entiende
            log.warn("Mercado Pago respondió {}: {}", e.getStatusCode(), e.getApiResponse() != null ? e.getApiResponse().getContent() : "");
            if (e.getStatusCode() == 401 || e.getStatusCode() == 403) {
                throw new MercadoPagoNoDisponibleException("Mercado Pago rechazó la credencial del gimnasio: revisá MP_ACCESS_TOKEN");
            }
            throw new MercadoPagoNoDisponibleException("Mercado Pago no aceptó el pago: revisá los datos de la tarjeta y probá de nuevo");
        } catch (MPException e) {
            log.warn("No se pudo hablar con Mercado Pago", e);
            throw new MercadoPagoNoDisponibleException("No se pudo hablar con Mercado Pago: revisá la conexión a internet y probá de nuevo");
        }
    }

    private MPRequestOptions opciones(Map<String, String> encabezados) {
        return MPRequestOptions.builder()
                .accessToken(modo == Modo.SIMULADOR ? "TEST-SIMULADOR" : accessToken)
                .customHeaders(encabezados)
                .connectionTimeout(5000)
                .socketTimeout(20000)
                .build();
    }
}
