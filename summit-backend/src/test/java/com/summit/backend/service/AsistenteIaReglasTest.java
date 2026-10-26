package com.summit.backend.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reglas exactas con las que el asistente de IA revisa lo que leyó de un certificado (AsistenteIaService.advertencias):
 * no dependen del modelo, así que se prueban sin Ollama.
 */
class AsistenteIaReglasTest {

    private static final LocalDate HACE_UN_MES = LocalDate.now().minusDays(30);

    private static List<String> revisar(String dniSocio, String dniLeido, Boolean apto, LocalDate emision, String fechaLeida,
                                        String matricula) {
        return AsistenteIaService.advertencias(dniSocio, "Juan Pérez", dniLeido, apto, emision, fechaLeida, matricula);
    }

    @Test
    void unCertificadoEnRegla() {
        assertThat(revisar("30111222", "30111222", true, HACE_UN_MES, null, "MP 12345")).isEmpty();
    }

    @Test
    void elDniSeComparaSoloPorLosNumeros() {
        assertThat(revisar("30.111.222", "30111222", true, HACE_UN_MES, null, "MP 12345")).isEmpty();
    }

    @Test
    void avisaSiEsDeOtraPersona() {
        assertThat(revisar("30111222", "40999888", true, HACE_UN_MES, null, "MP 12345"))
                .singleElement().asString().contains("otra persona").contains("40999888");
    }

    @Test
    void siNoSeLeyoElDniNoAcusaEnFalso() {
        assertThat(revisar("30111222", "", true, HACE_UN_MES, null, "MP 12345")).isEmpty();
    }

    @Test
    void avisaSiDiceQueNoEstaApto() {
        assertThat(revisar("30111222", "30111222", false, HACE_UN_MES, null, "MP 12345"))
                .anyMatch(a -> a.contains("NO está apto"));
    }

    @Test
    void avisaSiTieneMasDeUnAnio() {
        assertThat(revisar("30111222", "30111222", true, LocalDate.now().minusDays(400), null, "MP 12345"))
                .anyMatch(a -> a.contains("más de un año"));
    }

    @Test
    void distingueUnaFechaFuturaDeUnaQueNoExiste() {
        assertThat(revisar("30111222", "30111222", true, null, LocalDate.now().plusDays(10).toString(), "MP 12345"))
                .anyMatch(a -> a.contains("posterior a hoy"));
        assertThat(revisar("30111222", "30111222", true, null, "2026-02-31", "MP 12345"))
                .anyMatch(a -> a.contains("no existe en el calendario") && a.contains("31/02/2026"));
        assertThat(revisar("30111222", "30111222", true, null, "", "MP 12345"))
                .anyMatch(a -> a.contains("No se pudo leer la fecha"));
    }

    @Test
    void pideLaMatriculaDelMedicoConNumero() {
        assertThat(revisar("30111222", "30111222", true, HACE_UN_MES, null, ""))
                .anyMatch(a -> a.contains("No figura la matrícula"));
        assertThat(revisar("30111222", "30111222", true, HACE_UN_MES, null, "Dr. Gómez"))
                .anyMatch(a -> a.contains("no tiene número"));
    }
}
