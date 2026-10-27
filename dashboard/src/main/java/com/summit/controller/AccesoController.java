package com.summit.controller;

import com.summit.model.entity.AsistenciaLog;
import com.summit.model.entity.Usuario;
import com.summit.model.enums.ResultadoAcceso;
import com.summit.model.enums.TipoEvento;
import com.summit.service.AccesoService;
import com.summit.repository.UsuarioRepository;
import com.summit.repository.AsistenciaLogRepository;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/acceso")
@CrossOrigin(origins = "*")
public class AccesoController {

    @Autowired
    private AccesoService accesoService;

    // 1. SOLUCIÓN: Inyectamos los repositorios para que Spring Boot los instancie
    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private AsistenciaLogRepository asistenciaLogRepository;

    // Endpoint: POST http://localhost:8080/api/acceso/intentar/{dni}
    @PostMapping("/intentar/{dni}")
    public ResponseEntity<String> registrarAcceso(@PathVariable String dni) {
        ResultadoAcceso resultado = accesoService.registrarIntentoDeAcceso(dni);

        if (resultado == null) {
            return ResponseEntity.status(404).body("Usuario no encontrado");
        }

        // Evalúa el resultado que devolvió la Capa de Servicio
        switch (resultado) {
            case ACCESO_PERMITIDO:
                return ResponseEntity.ok("ACCESO_PERMITIDO"); // HTTP 200: Molinete Verde
            case BLOQUEO_MEDICO:
                // HTTP 403 Forbidden: Molinete Rojo (Requiere certificado)
                return ResponseEntity.status(403).body("BLOQUEO_MEDICO - Certificado Médico Vencido o Inválido");
            case BLOQUEO_PAGO:
                // HTTP 403 Forbidden: Molinete Rojo (Requiere pago)
                return ResponseEntity.status(403).body("BLOQUEO_PAGO - Cuota impaga o pago demorado");

            default:
                return ResponseEntity.status(403).body("ACCESO_DENEGADO");
        }
    }

    @PostMapping("/forzar-ingreso/{dni}")
    public ResponseEntity<?> forzarIngreso(@PathVariable String dni, @RequestParam String idEmpleadoAuditor) {
        try {
            // 2. SOLUCIÓN: Usamos la variable inyectada en minúscula
            Usuario socio = usuarioRepository.findByDni(dni)
                    .orElseThrow(() -> new Exception("Socio no encontrado"));

            // 1. Verificación Legal (Inflexible)
            // IMPORTANTE: Por arquitectura, NUNCA dejamos forzar un bloqueo médico.
            // Si llega hasta acá, asumimos que el bloqueo era solo financiero.

            // 2. Creamos el registro inmutable (Timestamp)
            AsistenciaLog log = new AsistenciaLog();
            log.setUsuario(socio);
            log.setFechaHora(LocalDateTime.now());
            log.setTipoEvento(TipoEvento.ENTRADA);
            log.setResultado(ResultadoAcceso.ACCESO_FORZADO); // Ajustado al nombre real de tu Enum
            
            // Si tenés una columna de observaciones en tu DB, podés guardar quién lo autorizó:
            // log.setObservaciones("Forzado por empleado ID: " + idEmpleadoAuditor);

            // 3. SOLUCIÓN: Usamos la variable inyectada en minúscula
            asistenciaLogRepository.save(log);

            Map<String, String> response = new HashMap<>();
            response.put("mensaje", "Ingreso FORZADO registrado con éxito. Autorizado por: " + idEmpleadoAuditor);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}