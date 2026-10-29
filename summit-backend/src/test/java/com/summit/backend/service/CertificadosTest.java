package com.summit.backend.service;

import com.summit.backend.PruebaIntegracion;
import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.model.EstadoLegalCertificado;
import com.summit.backend.model.ResultadoAsistencia;
import com.summit.backend.model.Usuario;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Certificados médicos (CertificadoMedicoService): valen 365 días desde la emisión (Ley 5397), no se cargan con fecha
 * futura ni vencidos, y uno rechazado deja de habilitar el ingreso.
 */
class CertificadosTest extends PruebaIntegracion {

    @Autowired CertificadoMedicoService certificados;
    @Autowired AsistenciaService asistencia;

    private static MockMultipartFile pdf() {
        return new MockMultipartFile("archivo", "apto.pdf", "application/pdf",
                "%PDF-1.4\n% certificado de prueba\n".getBytes(StandardCharsets.US_ASCII));
    }

    private Usuario socioConCuota() {
        Usuario socio = socio();
        membresia(socio, plan(10000, null), hoy().plusDays(30));
        return socio;
    }

    @Test
    void vale365DiasDesdeLaEmision() {
        Usuario socio = socioConCuota();
        CertificadoMedico apto = certificados.registrarCertificado(socio.getIdUsuario(), pdf(), hoy().minusDays(10), null, null);
        assertThat(apto.getFechaVencimiento()).isEqualTo(hoy().minusDays(10).plusDays(365));
        assertThat(apto.getEstadoLegal()).isEqualTo(EstadoLegalCertificado.VIGENTE);
        assertThat(asistencia.evaluarAcceso(socio).permitido()).isTrue();
    }

    @Test
    void noSeCargaConFechaFuturaNiVencido() {
        Usuario socio = socioConCuota();
        assertThatThrownBy(() -> certificados.registrarCertificado(socio.getIdUsuario(), pdf(), hoy().plusDays(1), null, null))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("futura");
        assertThatThrownBy(() -> certificados.registrarCertificado(socio.getIdUsuario(), pdf(), hoy().minusDays(400), null, null))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("vencido");
    }

    @Test
    void unoRechazadoNoHabilitaElIngreso() {
        Usuario socio = socioConCuota();
        CertificadoMedico apto = certificados.registrarCertificado(socio.getIdUsuario(), pdf(), hoy().minusDays(10), null, null);
        assertThatThrownBy(() -> certificados.cambiarEstado(socio.getIdUsuario(), apto.getIdCertificado(),
                EstadoLegalCertificado.RECHAZADO, "no", null)).isInstanceOf(IllegalArgumentException.class);

        certificados.cambiarEstado(socio.getIdUsuario(), apto.getIdCertificado(), EstadoLegalCertificado.RECHAZADO,
                "La firma no coincide con la del médico", null);
        assertThat(asistencia.evaluarAcceso(socio).resultado()).isEqualTo(ResultadoAsistencia.DENEGADO_CERTIFICADO_MEDICO);
    }
}
