package com.summit.backend.service;

import com.summit.backend.PruebaIntegracion;
import com.summit.backend.dto.CheckInResponse;
import com.summit.backend.dto.CongelamientoRequestDTO;
import com.summit.backend.model.EstadoLegalCertificado;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.MotivoCongelamiento;
import com.summit.backend.model.ResultadoAsistencia;
import com.summit.backend.model.Rol;
import com.summit.backend.model.TipoEventoAsistencia;
import com.summit.backend.model.Usuario;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.DayOfWeek;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Reglas de ingreso (AsistenciaService): cuenta, congelamiento, cuota con días de gracia, límite semanal, apto médico
 * e ingreso por excepción. Con la configuración por defecto: se exigen la cuota y el apto, 3 días de gracia para la
 * cuota y 7 para el apto, sin excepciones.
 */
class ControlAccesoTest extends PruebaIntegracion {

    @Autowired AsistenciaService asistencia;
    @Autowired CongelamientoService congelamientos;

    @Test
    void socioConCuotaYAptoAlDiaEntra() {
        Usuario socio = socioAlDia();
        assertThat(asistencia.evaluarAcceso(socio).permitido()).isTrue();
        CheckInResponse ficha = asistencia.verificarAccesoMolinete(socio.getDni());
        assertThat(ficha.isPermitido()).isTrue();
        assertThat(ficha.getResultado()).isEqualTo("PERMITIDO");
    }

    @Test
    void sinMembresiaNoEntra() {
        Usuario socio = socio();
        apto(socio, hoy().plusDays(100), EstadoLegalCertificado.VIGENTE);
        CheckInResponse ficha = asistencia.verificarAccesoMolinete(socio.getDni());
        assertThat(ficha.isPermitido()).isFalse();
        assertThat(ficha.getResultado()).isEqualTo(ResultadoAsistencia.DENEGADO_CUOTA_VENCIDA.name());
        assertThat(ficha.getFaltas()).anyMatch(f -> f.contains("No tiene una membresía activa"));
    }

    @Test
    void cuotaVencidaDentroDeLosDiasDeGraciaEntraConAviso() {
        Usuario socio = socio();
        membresia(socio, plan(10000, null), hoy().minusDays(2));
        apto(socio, hoy().plusDays(100), EstadoLegalCertificado.VIGENTE);
        CheckInResponse ficha = asistencia.verificarAccesoMolinete(socio.getDni());
        assertThat(ficha.isPermitido()).isTrue();
        assertThat(ficha.getAvisos()).anyMatch(a -> a.contains("días de gracia"));
    }

    @Test
    void cuotaVencidaFueraDeLosDiasDeGraciaNoEntra() {
        Usuario socio = socio();
        membresia(socio, plan(10000, null), hoy().minusDays(10));
        apto(socio, hoy().plusDays(100), EstadoLegalCertificado.VIGENTE);
        assertThat(asistencia.evaluarAcceso(socio).resultado()).isEqualTo(ResultadoAsistencia.DENEGADO_CUOTA_VENCIDA);
    }

    @Test
    void aptoVencidoNoEntraNiConExcepcion() {
        reglasDeAcceso(c -> c.setPermitirOverrideManual(true));
        Usuario socio = socio();
        membresia(socio, plan(10000, null), hoy().plusDays(10));
        apto(socio, hoy().minusDays(30), EstadoLegalCertificado.VIGENTE);
        assertThat(asistencia.evaluarAcceso(socio).resultado()).isEqualTo(ResultadoAsistencia.DENEGADO_CERTIFICADO_MEDICO);
        assertThatThrownBy(() -> asistencia.registrarIngresoExcepcion(socio.getDni(), "Se olvidó el apto", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("apto médico");
    }

    @Test
    void aptoRechazadoNoEntra() {
        Usuario socio = socio();
        membresia(socio, plan(10000, null), hoy().plusDays(10));
        apto(socio, hoy().plusDays(200), EstadoLegalCertificado.RECHAZADO);
        CheckInResponse ficha = asistencia.verificarAccesoMolinete(socio.getDni());
        assertThat(ficha.getResultado()).isEqualTo(ResultadoAsistencia.DENEGADO_CERTIFICADO_MEDICO.name());
        assertThat(ficha.getFaltas()).anyMatch(f -> f.contains("rechazado"));
    }

    @Test
    void sinLosDiasDelPlanEstaSemanaNoEntra() {
        // Hace falta un día anterior de la misma semana (de lunes a hoy): el lunes no se puede probar
        assumeTrue(hoy().getDayOfWeek() != DayOfWeek.MONDAY, "hoy es lunes: no hay un día anterior en la semana");
        Usuario socio = socio();
        membresia(socio, plan(10000, 1), hoy().plusDays(10));
        apto(socio, hoy().plusDays(200), EstadoLegalCertificado.VIGENTE);
        ingreso(socio, hoy().minusDays(1).atTime(10, 0));
        assertThat(asistencia.evaluarAcceso(socio).resultado()).isEqualTo(ResultadoAsistencia.DENEGADO_LIMITE_SEMANAL);
    }

    @Test
    void volverElMismoDiaNoDescuentaOtroDia() {
        Usuario socio = socio();
        membresia(socio, plan(10000, 1), hoy().plusDays(10));
        apto(socio, hoy().plusDays(200), EstadoLegalCertificado.VIGENTE);
        ingreso(socio, hoy().atStartOfDay().plusMinutes(1));
        CheckInResponse ficha = asistencia.verificarAccesoMolinete(socio.getDni());
        assertThat(ficha.isPermitido()).isTrue();
        assertThat(ficha.getAvisos()).anyMatch(a -> a.contains("Ya había ingresado hoy"));
    }

    @Test
    void conExcepcionesHabilitadasRecepcionDejaPasarConCuotaVencida() {
        reglasDeAcceso(c -> c.setPermitirOverrideManual(true));
        Usuario recepcion = usuario(Rol.RECEPCION);
        Usuario socio = socio();
        membresia(socio, plan(10000, null), hoy().minusDays(10));
        apto(socio, hoy().plusDays(100), EstadoLegalCertificado.VIGENTE);
        assertThat(asistencia.verificarAccesoMolinete(socio.getDni()).isExcepcionPosible()).isTrue();

        CheckInResponse ficha = asistencia.registrarIngresoExcepcion(socio.getDni(), "Pagó por transferencia", recepcion.getEmail());
        assertThat(ficha.isPermitido()).isTrue();
        assertThat(ficha.getMensaje()).contains("Ingreso por excepción").contains(recepcion.getNombreCompleto());
        assertThat(logAsistenciaRepository.findByUsuarioIdUsuarioOrderByFechaHoraDesc(socio.getIdUsuario()))
                .anyMatch(l -> l.getTipoEvento() == TipoEventoAsistencia.INGRESO_EXCEPCION
                        && l.getResultado() == ResultadoAsistencia.PERMITIDO);
    }

    @Test
    void sinExcepcionesHabilitadasNoSeLoPuedeDejarPasar() {
        Usuario socio = socio();
        membresia(socio, plan(10000, null), hoy().minusDays(10));
        apto(socio, hoy().plusDays(100), EstadoLegalCertificado.VIGENTE);
        assertThatThrownBy(() -> asistencia.registrarIngresoExcepcion(socio.getDni(), "Pagó por transferencia", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("no permite ingresos por excepción");
    }

    @Test
    void cuentaDadaDeBajaNoEntra() {
        Usuario socio = socioAlDia();
        socio.setEstado(EstadoUsuario.CANCELADO);
        usuarioRepository.save(socio);
        assertThat(asistencia.evaluarAcceso(socio).resultado()).isEqualTo(ResultadoAsistencia.DENEGADO_CUENTA_INACTIVA);
    }

    @Test
    void conLaMembresiaCongeladaNoEntraHastaQueSeTermina() {
        Usuario socio = socioAlDia();
        Long idCongelamiento = congelamientos.registrar(socio.getIdUsuario(),
                new CongelamientoRequestDTO(hoy(), hoy().plusDays(9), MotivoCongelamiento.VACACIONES, null), null).getIdCongelamiento();

        CheckInResponse ficha = asistencia.verificarAccesoMolinete(socio.getDni());
        assertThat(ficha.getResultado()).isEqualTo(ResultadoAsistencia.DENEGADO_MEMBRESIA_CONGELADA.name());
        assertThat(ficha.getIdCongelamiento()).isEqualTo(idCongelamiento);
        assertThat(ficha.isExcepcionPosible()).isFalse();

        congelamientos.terminar(socio.getIdUsuario(), idCongelamiento);
        assertThat(asistencia.evaluarAcceso(socio).permitido()).isTrue();
    }

    @Test
    void elPersonalNoPasaPorLosControlesDeSocio() {
        Usuario profesor = usuario(Rol.PROFESOR);
        CheckInResponse ficha = asistencia.verificarAccesoMolinete(profesor.getDni());
        assertThat(ficha.isPermitido()).isTrue();
        assertThat(ficha.getFichada()).isEqualTo("ENTRADA");
    }
}
