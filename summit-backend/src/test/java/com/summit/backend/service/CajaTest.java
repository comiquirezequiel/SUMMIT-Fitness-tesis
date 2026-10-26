package com.summit.backend.service;

import com.summit.backend.PruebaIntegracion;
import com.summit.backend.dto.CierreCajaDTO;
import com.summit.backend.dto.CierreRequestDTO;
import com.summit.backend.dto.GastoDTO;
import com.summit.backend.dto.GastoRequestDTO;
import com.summit.backend.dto.TurnoCajaDTO;
import com.summit.backend.model.CategoriaGasto;
import com.summit.backend.model.MetodoPago;
import com.summit.backend.model.Plan;
import com.summit.backend.model.Usuario;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Caja (CajaService): el efectivo esperado del turno es el fondo + los cobros en efectivo - los gastos en efectivo, el
 * cierre registra la diferencia (explicada) y lo que queda de fondo, y un gasto de un turno cerrado ya no se anula.
 */
class CajaTest extends PruebaIntegracion {

    @Autowired CajaService caja;
    @Autowired PagoService pagos;

    private GastoDTO gasto(int monto, MetodoPago metodo) {
        return caja.registrarGasto(new GastoRequestDTO(BigDecimal.valueOf(monto), CategoriaGasto.LIMPIEZA, "Artículos de limpieza", metodo, null), null);
    }

    private static BigDecimal pesos(int monto) {
        return BigDecimal.valueOf(monto);
    }

    @Test
    void elEfectivoEsperadoSumaCobrosYRestaGastosEnEfectivo() {
        TurnoCajaDTO antes = caja.turnoActual();
        Usuario socio = socio();
        Plan plan = plan(10000, null);
        pagos.registrarPago(cobro(socio, plan, 10000), null);
        gasto(1500, MetodoPago.EFECTIVO);
        gasto(3000, MetodoPago.TRANSFERENCIA);

        TurnoCajaDTO despues = caja.turnoActual();
        assertThat(despues.getEfectivoEsperado()).isEqualByComparingTo(antes.getEfectivoEsperado().add(pesos(8500)));
        assertThat(despues.getTotalEgresos()).isEqualByComparingTo(antes.getTotalEgresos().add(pesos(4500)));
        assertThat(despues.getCantidadGastos()).isEqualTo(antes.getCantidadGastos() + 2);
    }

    @Test
    void unGastoAnuladoNoCuenta() {
        TurnoCajaDTO antes = caja.turnoActual();
        GastoDTO g = gasto(2000, MetodoPago.EFECTIVO);
        assertThatThrownBy(() -> caja.anularGasto(g.getIdGasto(), "no", null)).isInstanceOf(IllegalArgumentException.class);
        assertThat(caja.anularGasto(g.getIdGasto(), "Se cargó dos veces", null).isAnulado()).isTrue();
        assertThat(caja.turnoActual().getEfectivoEsperado()).isEqualByComparingTo(antes.getEfectivoEsperado());
    }

    @Test
    void conDiferenciaElCierrePideUnaObservacion() {
        pagos.registrarPago(cobro(socio(), plan(10000, null), 10000), null);
        BigDecimal faltan500 = caja.turnoActual().getEfectivoEsperado().subtract(pesos(500));
        assertThatThrownBy(() -> caja.cerrar(new CierreRequestDTO(faltan500, null, null), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("faltante de $ 500");
        CierreCajaDTO cierre = caja.cerrar(new CierreRequestDTO(faltan500, null, "Vuelto de más a un socio"), null);
        assertThat(cierre.getDiferencia()).isEqualByComparingTo("-500");
        assertThat(cierre.getObservacion()).isEqualTo("Vuelto de más a un socio");
    }

    @Test
    void alCerrarQuedaElFondoParaElTurnoSiguiente() {
        Usuario socio = socio();
        pagos.registrarPago(cobro(socio, plan(10000, null), 10000), null);
        GastoDTO anterior = gasto(1000, MetodoPago.EFECTIVO);
        TurnoCajaDTO turno = caja.turnoActual();
        BigDecimal contado = turno.getEfectivoEsperado();

        CierreCajaDTO cierre = caja.cerrar(new CierreRequestDTO(contado, pesos(4000), null), null);
        assertThat(cierre.getDiferencia()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(cierre.getFondoSiguiente()).isEqualByComparingTo(contado.subtract(pesos(4000)));

        TurnoCajaDTO siguiente = caja.turnoActual();
        assertThat(siguiente.getFondoInicial()).isEqualByComparingTo(cierre.getFondoSiguiente());
        assertThat(siguiente.getCantidadCobros()).isZero();
        assertThatThrownBy(() -> caja.anularGasto(anterior.getIdGasto(), "Ya estaba cerrado", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("cierre de caja");
    }

    @Test
    void noSeRetiraMasEfectivoDelQueHay() {
        assertThatThrownBy(() -> caja.cerrar(new CierreRequestDTO(pesos(100), pesos(200), "Prueba"), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("retirar más");
    }
}
