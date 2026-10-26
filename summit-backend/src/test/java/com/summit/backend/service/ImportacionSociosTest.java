package com.summit.backend.service;

import com.summit.backend.PruebaIntegracion;
import com.summit.backend.dto.ImportacionSociosDTO;
import com.summit.backend.model.Plan;
import com.summit.backend.model.Usuario;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Importación de socios desde una planilla (ImportacionSociosService): cada fila por separado, sin tocar a los que ya
 * estaban y con la membresía hasta la fecha que dice la planilla.
 */
class ImportacionSociosTest extends PruebaIntegracion {

    @Autowired ImportacionSociosService importacion;

    private static ImportacionSociosDTO.Fila fila(int numero, String nombre, String dni, String email, String plan,
                                                  java.time.LocalDate vence) {
        return new ImportacionSociosDTO.Fila(numero, nombre, dni, email, null, null, null, null, null, null, null, plan, vence);
    }

    @Test
    void importaCadaFilaPorSeparado() {
        Plan plan = plan(10000, null);
        Usuario existente = socio();
        List<ImportacionSociosDTO.Resultado> resultados = importacion.importar(List.of(
                fila(2, "Ana Importada", "71000001", "ana.importada@test.summit", plan.getNombrePlan(), hoy().plusDays(15)),
                fila(3, "Ya Estaba", existente.getDni(), "otro.email@test.summit", null, null),
                fila(4, "Mal Mail", "71000003", "sin-arroba", null, null),
                fila(5, "Plan Raro", "71000004", "plan.raro@test.summit", "Plan que no existe", hoy().plusDays(15)),
                fila(6, "Repetida", "71000001", "repetida@test.summit", null, null)));

        assertThat(resultados).extracting(ImportacionSociosDTO.Resultado::estado)
                .containsExactly("CREADO", "EXISTE", "ERROR", "CREADO", "ERROR");
        assertThat(resultados.get(0).mensaje()).contains(plan.getNombrePlan());
        assertThat(suscripcionRepository.ultimoVencimiento(resultados.get(0).idSocio())).isEqualTo(hoy().plusDays(15));
        assertThat(resultados.get(2).mensaje()).containsIgnoringCase("email");
        assertThat(resultados.get(3).aviso()).contains("No existe el plan");
        assertThat(resultados.get(4).mensaje()).contains("repetido en la planilla (fila 2)");
        // Al que ya estaba no se le cambió nada
        assertThat(usuarioRepository.findById(existente.getIdUsuario()).orElseThrow().getEmail()).isEqualTo(existente.getEmail());
    }
}
