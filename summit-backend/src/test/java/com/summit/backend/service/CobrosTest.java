package com.summit.backend.service;

import com.summit.backend.PruebaIntegracion;
import com.summit.backend.dto.CobroRequestDTO;
import com.summit.backend.dto.DescuentoDTO;
import com.summit.backend.dto.DescuentoRequestDTO;
import com.summit.backend.dto.PagoListadoDTO;
import com.summit.backend.dto.PresupuestoDTO;
import com.summit.backend.dto.SocioResponseDTO;
import com.summit.backend.model.EstadoPago;
import com.summit.backend.model.MetodoPago;
import com.summit.backend.model.PagoHistorial;
import com.summit.backend.model.Plan;
import com.summit.backend.model.ReglasMembresia;
import com.summit.backend.model.TipoDescuento;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.PagoHistorialRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Cobros (PagoService): solo un pago aprobado extiende la membresía, el total lo calcula el backend (plan - descuento
 * + matrícula) y no se cobra si el total que vio recepción ya no es el que corresponde.
 */
class CobrosTest extends PruebaIntegracion {

    @Autowired PagoService pagos;
    @Autowired DescuentoService descuentos;
    @Autowired ReglasMembresiaService reglas;
    @Autowired PagoHistorialRepository pagoHistorialRepository;
    @Autowired SocioService socios;

    private LocalDate vencimiento(Usuario socio) {
        return suscripcionRepository.ultimoVencimiento(socio.getIdUsuario());
    }

    private SocioResponseDTO enLaLista(Usuario socio) {
        return socios.listarTodos().stream()
                .filter(s -> s.getIdSocio().equals(socio.getIdUsuario()))
                .findFirst()
                .orElseThrow();
    }

    private void matricula(int monto, int diasReinscripcion) {
        reglas.actualizar(ReglasMembresia.builder()
                .matriculaMonto(BigDecimal.valueOf(monto))
                .matriculaReinscripcionDias(diasReinscripcion)
                .congelamientoMinDias(7)
                .congelamientoMaxDiasAnio(30)
                .build());
    }

    @Test
    void unCobroAprobadoExtiendeLaMembresiaDesdeElVencimientoActual() {
        Usuario socio = socio();
        Plan plan = plan(10000, null);
        PagoListadoDTO primero = pagos.registrarPago(cobro(socio, plan, 10000), null);
        assertThat(primero.getEstado()).isEqualTo("APROBADO");
        assertThat(vencimiento(socio)).isEqualTo(hoy().plusDays(30));
        assertThat(primero.getVenceMembresia()).isEqualTo(hoy().plusDays(30));

        pagos.registrarPago(cobro(socio, plan, 10000), null);
        assertThat(vencimiento(socio)).isEqualTo(hoy().plusDays(60));
    }

    @Test
    void unCobroAVerificarNoExtiendeHastaQueElAdminLoAprueba() {
        Usuario socio = socio();
        Plan plan = plan(10000, null);
        CobroRequestDTO pedido = cobro(socio, plan, 10000);
        pedido.setMetodoPago("TRANSFERENCIA");
        pedido.setAVerificar(true);
        PagoListadoDTO pago = pagos.registrarPago(pedido, null);
        assertThat(pago.getEstado()).isEqualTo("PENDIENTE");
        assertThat(vencimiento(socio)).isNull();

        PagoListadoDTO aprobado = pagos.verificarPago(pago.getIdPago(), true, null);
        assertThat(aprobado.getEstado()).isEqualTo("APROBADO");
        assertThat(vencimiento(socio)).isEqualTo(hoy().plusDays(30));
        assertThatThrownBy(() -> pagos.verificarPago(pago.getIdPago(), true, null)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void unCobroRechazadoNoExtiende() {
        Usuario socio = socio();
        CobroRequestDTO pedido = cobro(socio, plan(10000, null), 10000);
        pedido.setMetodoPago("MERCADO_PAGO");
        pedido.setAVerificar(true);
        PagoListadoDTO pago = pagos.registrarPago(pedido, null);
        assertThat(pagos.verificarPago(pago.getIdPago(), false, null).getEstado()).isEqualTo("RECHAZADO");
        assertThat(vencimiento(socio)).isNull();
    }

    @Test
    void elEfectivoNoPuedeQuedarAVerificar() {
        CobroRequestDTO pedido = cobro(socio(), plan(10000, null), 10000);
        pedido.setAVerificar(true);
        assertThatThrownBy(() -> pagos.registrarPago(pedido, null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void elTotalEsElPlanMenosElDescuentoMasLaMatricula() {
        matricula(5000, 30);
        DescuentoDTO familiar = descuentos.crear(new DescuentoRequestDTO("Familiar prueba", TipoDescuento.PORCENTAJE, BigDecimal.TEN, true));
        Usuario socio = socio();
        CobroRequestDTO pedido = cobro(socio, plan(10000, null), 14000);
        pedido.setIdDescuento(familiar.getIdDescuento());

        PresupuestoDTO presupuesto = pagos.presupuesto(pedido);
        assertThat(presupuesto.getDescuentoMonto()).isEqualByComparingTo("1000");
        assertThat(presupuesto.isMatriculaCorresponde()).isTrue();
        assertThat(presupuesto.getTotal()).isEqualByComparingTo("14000");

        PagoListadoDTO pago = pagos.registrarPago(pedido, null);
        assertThat(pago.getMonto()).isEqualByComparingTo("14000");
        assertThat(pago.getPrecioLista()).isEqualByComparingTo("10000");
        assertThat(pago.getMatriculaMonto()).isEqualByComparingTo("5000");
        assertThat(pago.getDescuentoNombre()).isEqualTo("Familiar prueba");
        // Ya tiene membresía: el próximo cobro no lleva matrícula
        assertThat(pagos.presupuesto(cobro(socio, plan(10000, null), 10000)).isMatriculaCorresponde()).isFalse();
    }

    @Test
    void laMatriculaSePuedeBonificar() {
        matricula(5000, 30);
        CobroRequestDTO pedido = cobro(socio(), plan(10000, null), 10000);
        pedido.setBonificarMatricula(true);
        PagoListadoDTO pago = pagos.registrarPago(pedido, null);
        assertThat(pago.getMonto()).isEqualByComparingTo("10000");
        assertThat(pago.getMatriculaMonto()).isEqualByComparingTo("0");
    }

    @Test
    void siElTotalCambioNoSeCobraNada() {
        Usuario socio = socio();
        assertThatThrownBy(() -> pagos.registrarPago(cobro(socio, plan(10000, null), 9000), null))
                .isInstanceOf(PagoService.TotalCambiadoException.class)
                .hasMessageContaining("10.000");
        assertThat(pagoHistorialRepository.findByUsuarioIdUsuarioOrderByFechaPagoDesc(socio.getIdUsuario())).isEmpty();
    }

    @Test
    void sinElTotalQueVioRecepcionNoSeCobra() {
        CobroRequestDTO pedido = cobro(socio(), plan(10000, null), 10000);
        pedido.setTotalMostrado(null);
        assertThatThrownBy(() -> pagos.registrarPago(pedido, null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void laMatriculaVuelveACobrarseDespuesDeMuchoTiempoSinCuota() {
        matricula(5000, 30);
        Plan plan = plan(10000, null);
        Usuario volvio = socio();
        membresia(volvio, plan, hoy().minusDays(45));
        PresupuestoDTO conMatricula = pagos.presupuesto(cobro(volvio, plan, 15000));
        assertThat(conMatricula.isMatriculaCorresponde()).isTrue();
        assertThat(conMatricula.getMatriculaMotivo()).contains("Reinscripción");

        Usuario reciente = socio();
        membresia(reciente, plan, hoy().minusDays(20));
        assertThat(pagos.presupuesto(cobro(reciente, plan, 10000)).isMatriculaCorresponde()).isFalse();
    }

    @Test
    void laListaDeSociosMarcaElCobroAVerificarHastaQueSeConfirma() {
        Usuario socio = socio();
        Plan plan = plan(10000, null);
        CobroRequestDTO pedido = cobro(socio, plan, 10000);
        pedido.setMetodoPago("TRANSFERENCIA");
        pedido.setAVerificar(true);
        PagoListadoDTO pago = pagos.registrarPago(pedido, null);
        assertThat(enLaLista(socio).isCobroAVerificar()).isTrue();
        assertThat(socios.buscarPorId(socio.getIdUsuario()).isCobroAVerificar()).isTrue();

        pagos.verificarPago(pago.getIdPago(), true, null);
        SocioResponseDTO alDia = enLaLista(socio);
        assertThat(alDia.isCobroAVerificar()).isFalse();
        assertThat(alDia.getIdPlanActual()).isEqualTo(plan.getIdPlan());
        assertThat(socios.buscarPorId(socio.getIdUsuario()).isCobroAVerificar()).isFalse();
    }

    @Test
    void unCobroAVerificarOlvidadoNoFrenaElCobro() {
        Usuario socio = socio();
        pagoHistorialRepository.save(PagoHistorial.builder()
                .usuario(socio)
                .plan(plan(10000, null))
                .montoAbonado(BigDecimal.valueOf(10000))
                .metodoPago(MetodoPago.TRANSFERENCIA)
                .estadoPago(EstadoPago.PENDIENTE)
                .fechaPago(LocalDateTime.now().minusDays(PagoService.DIAS_COBRO_A_VERIFICAR + 1))
                .build());
        assertThat(enLaLista(socio).isCobroAVerificar()).isFalse();
        assertThat(socios.buscarPorId(socio.getIdUsuario()).isCobroAVerificar()).isFalse();
    }

    @Test
    void unDebitoAutomaticoNoSeCargaAMano() {
        CobroRequestDTO pedido = cobro(socio(), plan(10000, null), 10000);
        pedido.setMetodoPago("DEBITO_AUTOMATICO");
        assertThatThrownBy(() -> pagos.registrarPago(pedido, null)).isInstanceOf(IllegalArgumentException.class);
    }
}
