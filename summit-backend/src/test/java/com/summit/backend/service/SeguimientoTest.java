package com.summit.backend.service;

import com.summit.backend.PruebaIntegracion;
import com.summit.backend.dto.InactividadDTO;
import com.summit.backend.dto.TareaDTO;
import com.summit.backend.model.Plan;
import com.summit.backend.model.Usuario;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Seguimiento (SeguimientoService): niveles de inactividad, tareas automáticas que no se duplican y que se resuelven
 * solas cuando el socio vuelve o renueva.
 */
class SeguimientoTest extends PruebaIntegracion {

    @Autowired SeguimientoService seguimiento;
    @Autowired PagoService pagos;

    private List<TareaDTO> tareasDe(Usuario socio, String tipo) {
        return seguimiento.pendientes().stream()
                .filter(t -> t.idSocio().equals(socio.getIdUsuario()) && t.tipo().equals(tipo))
                .toList();
    }

    private TareaDTO resueltaDe(Usuario socio, String tipo) {
        return seguimiento.resueltas(50).stream()
                .filter(t -> t.idSocio().equals(socio.getIdUsuario()) && t.tipo().equals(tipo))
                .findFirst().orElse(null);
    }

    @Test
    void unSocioAlDiaQueHace20DiasQueNoVieneEsAlertaMedia() {
        Usuario socio = socioAlDia();
        ingreso(socio, hoy().minusDays(20).atTime(9, 0));
        InactividadDTO.Socio fila = seguimiento.inactividad(7).getSocios().stream()
                .filter(s -> s.idSocio().equals(socio.getIdUsuario())).findFirst().orElseThrow();
        assertThat(fila.nivel()).isEqualTo("MEDIO");
        assertThat(fila.diasSinVenir()).isEqualTo(20);
        assertThat(fila.ingresos90()).isEqualTo(1);
    }

    @Test
    void quienVinoEstaSemanaNoApareceComoInactivo() {
        Usuario socio = socioAlDia();
        ingreso(socio, hoy().minusDays(2).atTime(9, 0));
        assertThat(seguimiento.inactividad(7).getSocios()).noneMatch(s -> s.idSocio().equals(socio.getIdUsuario()));
    }

    @Test
    void laTareaDeInactividadNoSeDuplicaYSeResuelveSolaCuandoVuelve() {
        Usuario socio = socioAlDia();
        ingreso(socio, hoy().minusDays(20).atTime(9, 0));
        seguimiento.generarTareas();
        seguimiento.generarTareas();
        assertThat(tareasDe(socio, "INACTIVO")).hasSize(1);

        ingreso(socio, hoy().atStartOfDay().plusMinutes(1));
        seguimiento.generarTareas();
        assertThat(tareasDe(socio, "INACTIVO")).isEmpty();
        assertThat(resueltaDe(socio, "INACTIVO").nota()).contains("Volvió al gimnasio");
    }

    @Test
    void laCuotaPorVencerNoGeneraTareaYLaVencidaSeResuelveSolaCuandoRenueva() {
        Usuario socio = socio();
        Plan plan = plan(10000, null);
        membresia(socio, plan, hoy().plusDays(3));
        ingreso(socio, hoy().minusDays(1).atTime(9, 0));
        seguimiento.generarTareas();
        assertThat(tareasDe(socio, "CUOTA_POR_VENCER")).isEmpty();

        Usuario vencido = socio();
        membresia(vencido, plan, hoy().minusDays(3));
        seguimiento.generarTareas();
        assertThat(tareasDe(vencido, "CUOTA_VENCIDA")).hasSize(1);

        pagos.registrarPago(cobro(vencido, plan, 10000), null);
        seguimiento.generarTareas();
        assertThat(tareasDe(vencido, "CUOTA_VENCIDA")).isEmpty();
        assertThat(resueltaDe(vencido, "CUOTA_VENCIDA").nota()).contains("Renovó la cuota");
    }
}
