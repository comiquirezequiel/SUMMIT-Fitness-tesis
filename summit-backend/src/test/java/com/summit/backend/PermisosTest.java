package com.summit.backend;

import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Permisos por rol (SecurityConfig) y por estado de la cuenta, llamando a la API como lo hace el panel.
 */
class PermisosTest extends PruebaIntegracion {

    private static final String JSON_VACIO = "{}";

    @Test
    void sinSesionLaApiResponde401() throws Exception {
        mvc.perform(get("/api/socios")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/caja/turno")).andExpect(status().isUnauthorized());
    }

    @Test
    void elProfesorVeLosSociosPeroNoCobraNiVeLaCaja() throws Exception {
        String profesor = token(usuario(Rol.PROFESOR));
        mvc.perform(get("/api/socios").header("Authorization", profesor)).andExpect(status().isOk());
        mvc.perform(post("/api/pagos").header("Authorization", profesor).contentType(MediaType.APPLICATION_JSON).content(JSON_VACIO))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/caja/turno").header("Authorization", profesor)).andExpect(status().isForbidden());
        mvc.perform(get("/api/seguimiento/tareas").header("Authorization", profesor)).andExpect(status().isForbidden());
    }

    @Test
    void recepcionCobraYVeLaCajaPeroNoCambiaReglasNiImporta() throws Exception {
        String recepcion = token(usuario(Rol.RECEPCION));
        mvc.perform(get("/api/caja/turno").header("Authorization", recepcion)).andExpect(status().isOk());
        mvc.perform(get("/api/configuracion/membresias").header("Authorization", recepcion)).andExpect(status().isOk());
        mvc.perform(put("/api/configuracion/membresias").header("Authorization", recepcion).contentType(MediaType.APPLICATION_JSON).content(JSON_VACIO))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/configuracion/descuentos/1").header("Authorization", recepcion)).andExpect(status().isForbidden());
        mvc.perform(post("/api/socios/importar").header("Authorization", recepcion).contentType(MediaType.APPLICATION_JSON).content("{\"filas\":[]}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/pagos/1/verificar").header("Authorization", recepcion).contentType(MediaType.APPLICATION_JSON).content("{\"aprobado\":true}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void elAdminCambiaLasReglasDeMembresia() throws Exception {
        String admin = token(usuario(Rol.ADMIN));
        mvc.perform(put("/api/configuracion/membresias").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"matriculaMonto\":3000,\"matriculaReinscripcionDias\":30,\"congelamientoMinDias\":7,\"congelamientoMaxDiasAnio\":30}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matriculaMonto").value(3000));
    }

    @Test
    void unSocioNoEntraAlSistema() throws Exception {
        Usuario socio = socio();
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + socio.getEmail() + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", containsString("Credenciales inválidas")));
    }

    @Test
    void conUnaContrasenaTemporalPrimeroTieneQueCambiarla() throws Exception {
        Usuario recepcion = usuario(Rol.RECEPCION);
        recepcion.setDebeCambiarPassword(true);
        usuarioRepository.save(recepcion);
        mvc.perform(get("/api/socios").header("Authorization", token(recepcion)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("CAMBIAR_PASSWORD"));
    }

    @Test
    void unaCuentaDadaDeBajaPierdeLaSesion() throws Exception {
        Usuario recepcion = usuario(Rol.RECEPCION);
        String sesion = token(recepcion);
        recepcion.setEstado(com.summit.backend.model.EstadoUsuario.CANCELADO);
        usuarioRepository.save(recepcion);
        mvc.perform(get("/api/socios").header("Authorization", sesion)).andExpect(status().isUnauthorized());
    }
}
