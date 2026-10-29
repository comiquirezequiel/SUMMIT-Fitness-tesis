package com.summit.backend.service;

import com.summit.backend.dto.CobroConTarjetaDTO;
import com.summit.backend.dto.PagoListadoDTO;
import com.summit.backend.dto.PresupuestoDTO;
import com.summit.backend.mercadopago.PasarelaTarjeta;
import com.summit.backend.model.EstadoPago;
import com.summit.backend.model.MetodoPago;
import com.summit.backend.model.PagoHistorial;
import com.summit.backend.repository.PagoHistorialRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.Map;

/**
 * Cobro con tarjeta en recepción por Mercado Pago. El orden importa: primero se calcula el cobro y se controla contra
 * el total que vio recepción (como cualquier cobro), recién después se cobra en Mercado Pago, y al final se registra
 * con el id de Mercado Pago (que no se repite). Si Mercado Pago lo rechaza no se registra nada; si lo deja en proceso,
 * queda a verificar y una tarea lo confirma sola cuando se acredita (sin exponer el sistema a internet).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CobroConTarjetaService {

    // Qué le dice recepción al socio según el motivo del rechazo (status_detail de Mercado Pago)
    private static final Map<String, String> MOTIVOS = Map.of(
            "cc_rejected_insufficient_amount", "la tarjeta no tiene fondos suficientes",
            "cc_rejected_bad_filled_security_code", "el código de seguridad es incorrecto",
            "cc_rejected_bad_filled_date", "la fecha de vencimiento es incorrecta",
            "cc_rejected_bad_filled_card_number", "el número de tarjeta es incorrecto",
            "cc_rejected_bad_filled_other", "hay un dato de la tarjeta mal cargado",
            "cc_rejected_call_for_authorize", "el banco pide que el titular autorice el pago (llamando al banco)",
            "cc_rejected_card_disabled", "la tarjeta está inhabilitada: el titular tiene que activarla",
            "cc_rejected_duplicated_payment", "ya hay un pago igual hecho recién",
            "cc_rejected_max_attempts", "se superó la cantidad de intentos: probá con otra tarjeta",
            "cc_rejected_high_risk", "Mercado Pago lo rechazó por seguridad: probá con otra tarjeta o medio de pago");

    private final PagoService pagoService;
    private final PasarelaTarjeta pasarela;
    private final PagoHistorialRepository pagoHistorialRepository;

    /** Mercado Pago rechazó la tarjeta: no se registró nada. El mensaje es para mostrarle a recepción. */
    public static class TarjetaRechazadaException extends RuntimeException {
        public TarjetaRechazadaException(String mensaje) {
            super(mensaje);
        }
    }

    /**
     * Cobra con la tarjeta y registra el pago (aprobado, o a verificar si quedó en proceso).
     *
     * @throws PagoService.TotalCambiadoException si el total que vio recepción ya no es el que corresponde (no se
     *                                            llega a cobrar)
     * @throws TarjetaRechazadaException          si Mercado Pago rechazó la tarjeta
     */
    public PagoListadoDTO cobrar(CobroConTarjetaDTO pedido, String emailRegistrador) {
        if (pedido.cobro() == null || pedido.tarjeta() == null || blanco(pedido.tarjeta().token())) {
            throw new IllegalArgumentException("Faltan los datos de la tarjeta: cargala de nuevo");
        }
        if (blanco(pedido.idempotencia()) || pedido.idempotencia().length() > 64) {
            throw new IllegalArgumentException("Falta la clave del intento de cobro: volvé a abrir el cobro");
        }
        PresupuestoDTO detalle = pagoService.prepararCobro(pedido.cobro());
        PasarelaTarjeta.Resultado resultado = pasarela.cobrar(detalle.getTotal(), pedido.tarjeta(),
                "SUMMIT - " + detalle.getPlan(), pedido.idempotencia());
        if (resultado.rechazado()) {
            throw new TarjetaRechazadaException("Mercado Pago rechazó el pago: "
                    + MOTIVOS.getOrDefault(resultado.detalle(), "probá con otra tarjeta o con otro medio de pago"));
        }
        return pagoService.registrarCobroConTarjeta(pedido.cobro(), detalle, resultado.metodo(), resultado.id(),
                resultado.aprobado(), emailRegistrador);
    }

    /** Pregunta por los cobros con tarjeta que quedaron en proceso: el acreditado se aprueba y el rechazado, también. */
    @Scheduled(fixedDelayString = "${summit.pagos.tarjeta.revisar-ms:300000}", initialDelay = 60000)
    public void revisarEnProceso() {
        if (!pasarela.habilitada()) {
            return;
        }
        for (PagoHistorial pago : pagoHistorialRepository.findByEstadoPagoAndMpPaymentIdNotNullAndMetodoPagoIn(
                EstadoPago.PENDIENTE, EnumSet.of(MetodoPago.TARJETA_CREDITO, MetodoPago.TARJETA_DEBITO))) {
            try {
                PasarelaTarjeta.Resultado resultado = pasarela.consultar(pago.getMpPaymentId());
                if (resultado.aprobado() || resultado.rechazado()) {
                    pagoService.verificarPago(pago.getIdPago(), resultado.aprobado(), null);
                }
            } catch (RuntimeException e) {
                log.warn("No se pudo revisar el pago con tarjeta {} en Mercado Pago: {}", pago.getMpPaymentId(), e.getMessage());
            }
        }
    }

    private static boolean blanco(String texto) {
        return texto == null || texto.isBlank();
    }
}
