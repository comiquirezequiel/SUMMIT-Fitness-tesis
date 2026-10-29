package com.summit.backend.service;

import com.summit.backend.PruebaIntegracion;
import com.summit.backend.dto.CobroConTarjetaDTO;
import com.summit.backend.dto.PagoListadoDTO;
import com.summit.backend.model.Plan;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.PagoHistorialRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Cobro con tarjeta (CobroConTarjetaService) contra el simulador de Mercado Pago: el titular de la tarjeta de prueba
 * decide el resultado, como en Mercado Pago (APRO aprueba, CONT queda en proceso, FUND rechaza...).
 */
class CobroConTarjetaTest extends PruebaIntegracion {

    @Autowired CobroConTarjetaService tarjetas;
    @Autowired PagoService pagos;
    @Autowired PagoHistorialRepository pagoHistorialRepository;

    private static CobroConTarjetaDTO conTarjeta(Usuario socio, Plan plan, int totalMostrado, String titular, String clave) {
        return new CobroConTarjetaDTO(cobro(socio, plan, totalMostrado),
                new CobroConTarjetaDTO.Tarjeta("SIM-" + titular + "-" + UUID.randomUUID(), "visa", null, 1,
                        "socio@summit.com", "DNI", "30111222"),
                clave);
    }

    private long pagosDe(Usuario socio) {
        return pagos.historialPorSocio(socio.getIdUsuario()).size();
    }

    @Test
    void unaTarjetaAprobadaRegistraElCobroYExtiendeLaMembresia() {
        Usuario socio = socio();
        PagoListadoDTO pago = tarjetas.cobrar(conTarjeta(socio, plan(12000, null), 12000, "APRO", UUID.randomUUID().toString()), null);
        assertThat(pago.estado()).isEqualTo("APROBADO");
        assertThat(pago.metodoPago()).isEqualTo("TARJETA_CREDITO");
        assertThat(pago.comprobante()).startsWith("MP ");
        assertThat(suscripcionRepository.ultimoVencimiento(socio.getIdUsuario())).isEqualTo(hoy().plusDays(30));
    }

    @Test
    void unaTarjetaRechazadaNoRegistraNada() {
        Usuario socio = socio();
        assertThatThrownBy(() -> tarjetas.cobrar(conTarjeta(socio, plan(12000, null), 12000, "FUND", UUID.randomUUID().toString()), null))
                .isInstanceOf(CobroConTarjetaService.TarjetaRechazadaException.class)
                .hasMessageContaining("fondos suficientes");
        assertThat(pagosDe(socio)).isZero();
        assertThat(suscripcionRepository.ultimoVencimiento(socio.getIdUsuario())).isNull();
    }

    @Test
    void unPagoEnProcesoQuedaAVerificarYSeConfirmaSoloCuandoSeAcredita() {
        Usuario socio = socio();
        PagoListadoDTO pago = tarjetas.cobrar(conTarjeta(socio, plan(12000, null), 12000, "CONT", UUID.randomUUID().toString()), null);
        assertThat(pago.estado()).isEqualTo("PENDIENTE");
        assertThat(suscripcionRepository.ultimoVencimiento(socio.getIdUsuario())).isNull();

        tarjetas.revisarEnProceso();
        assertThat(pagoHistorialRepository.findById(pago.idPago()).orElseThrow().getEstadoPago().name()).isEqualTo("APROBADO");
        assertThat(suscripcionRepository.ultimoVencimiento(socio.getIdUsuario())).isEqualTo(hoy().plusDays(30));
    }

    @Test
    void elMismoIntentoRepetidoNoCobraDosVeces() {
        Usuario socio = socio();
        Plan plan = plan(12000, null);
        String clave = UUID.randomUUID().toString();
        PagoListadoDTO primero = tarjetas.cobrar(conTarjeta(socio, plan, 12000, "APRO", clave), null);
        PagoListadoDTO repetido = tarjetas.cobrar(conTarjeta(socio, plan, 12000, "APRO", clave), null);
        assertThat(repetido.idPago()).isEqualTo(primero.idPago());
        assertThat(pagosDe(socio)).isEqualTo(1);
        assertThat(suscripcionRepository.ultimoVencimiento(socio.getIdUsuario())).isEqualTo(hoy().plusDays(30));
    }

    @Test
    void siCambioElTotalNoSeLlegaACobrar() {
        Usuario socio = socio();
        assertThatThrownBy(() -> tarjetas.cobrar(conTarjeta(socio, plan(12000, null), 10000, "APRO", UUID.randomUUID().toString()), null))
                .isInstanceOf(PagoService.TotalCambiadoException.class);
        assertThat(pagosDe(socio)).isZero();
    }
}
