package com.summit.backend.service;

import com.summit.backend.PruebaIntegracion;
import com.summit.backend.dto.CongelamientoDTO;
import com.summit.backend.dto.CongelamientoRequestDTO;
import com.summit.backend.model.Congelamiento;
import com.summit.backend.model.MotivoCongelamiento;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.CongelamientoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Congelamiento de membresías (con las reglas por defecto: de 7 días o más y hasta 30 por año): corre el vencimiento,
 * no se superpone, respeta los límites y devuelve los días que no se usaron.
 */
class CongelamientoTest extends PruebaIntegracion {

    @Autowired CongelamientoService congelamientos;
    @Autowired CongelamientoRepository congelamientoRepository;

    private CongelamientoDTO congelar(Usuario socio, LocalDate desde, LocalDate hasta) {
        return congelamientos.registrar(socio.getIdUsuario(),
                new CongelamientoRequestDTO(desde, hasta, MotivoCongelamiento.VACACIONES, null), null);
    }

    private LocalDate vencimiento(Usuario socio) {
        return suscripcionRepository.ultimoVencimiento(socio.getIdUsuario());
    }

    @Test
    void congelarCorreElVencimientoEsosDias() {
        Usuario socio = socioAlDia(); // vence en 20 días
        CongelamientoDTO c = congelar(socio, hoy().plusDays(5), hoy().plusDays(14));
        assertThat(c.getDias()).isEqualTo(10);
        assertThat(c.getEstado()).isEqualTo("PROGRAMADO");
        assertThat(vencimiento(socio)).isEqualTo(hoy().plusDays(30));
    }

    @Test
    void noSeCongelaParaAtrasNiMenosDelMinimo() {
        Usuario socio = socioAlDia();
        assertThatThrownBy(() -> congelar(socio, hoy().minusDays(1), hoy().plusDays(10)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("hoy o más adelante");
        assertThatThrownBy(() -> congelar(socio, hoy(), hoy().plusDays(3)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("mínimo");
    }

    @Test
    void dosCongelamientosNoSeSuperponen() {
        Usuario socio = socioAlDia();
        congelar(socio, hoy().plusDays(1), hoy().plusDays(10));
        assertThatThrownBy(() -> congelar(socio, hoy().plusDays(5), hoy().plusDays(15)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("en esas fechas");
    }

    @Test
    void noSePasaDelMaximoPorAnio() {
        // El tope cuenta por el año en que empieza cada congelamiento: los dos tienen que empezar el mismo año
        assumeTrue(hoy().plusDays(25).getYear() == hoy().getYear(), "cerca de fin de año: los dos caerían en años distintos");
        Usuario socio = socioAlDia();
        membresia(socio, plan(10000, null), hoy().plusDays(60));
        congelar(socio, hoy().plusDays(1), hoy().plusDays(20)); // 20 días
        assertThatThrownBy(() -> congelar(socio, hoy().plusDays(25), hoy().plusDays(39)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("le quedan 10 días");
    }

    @Test
    void siLaMembresiaVenceAntesDeEmpezarNoSeCongela() {
        Usuario socio = socioAlDia(); // vence en 20 días
        assertThatThrownBy(() -> congelar(socio, hoy().plusDays(25), hoy().plusDays(35)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("primero tiene que renovarla");
    }

    @Test
    void anularUnoProgramadoDevuelveTodosLosDias() {
        Usuario socio = socioAlDia();
        CongelamientoDTO c = congelar(socio, hoy().plusDays(3), hoy().plusDays(12));
        CongelamientoDTO anulado = congelamientos.terminar(socio.getIdUsuario(), c.getIdCongelamiento());
        assertThat(anulado.getEstado()).isEqualTo("ANULADO");
        assertThat(vencimiento(socio)).isEqualTo(hoy().plusDays(20));
        assertThatThrownBy(() -> congelamientos.terminar(socio.getIdUsuario(), c.getIdCongelamiento()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void siVuelveAntesSeDescuentanLosDiasQueNoUso() {
        Usuario socio = socioAlDia();
        CongelamientoDTO c = congelar(socio, hoy(), hoy().plusDays(9)); // vencimiento: 20 + 10 = 30 días
        // Como si hubiera empezado hace 3 días (del día -3 al +6)
        Congelamiento guardado = congelamientoRepository.findById(c.getIdCongelamiento()).orElseThrow();
        guardado.setDesde(hoy().minusDays(3));
        guardado.setHasta(hoy().plusDays(6));
        congelamientoRepository.save(guardado);

        CongelamientoDTO terminado = congelamientos.terminar(socio.getIdUsuario(), c.getIdCongelamiento());
        assertThat(terminado.isTerminadoAntes()).isTrue();
        assertThat(terminado.getHasta()).isEqualTo(hoy().minusDays(1));
        assertThat(terminado.getDias()).isEqualTo(3);
        assertThat(vencimiento(socio)).isEqualTo(hoy().plusDays(23)); // se devolvieron 7 días
    }
}
