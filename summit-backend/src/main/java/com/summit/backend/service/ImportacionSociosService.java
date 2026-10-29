package com.summit.backend.service;

import com.summit.backend.dto.ImportacionSociosDTO;
import com.summit.backend.dto.SocioRequestDTO;
import com.summit.backend.dto.SocioResponseDTO;
import com.summit.backend.model.Plan;
import com.summit.backend.model.Suscripcion;
import com.summit.backend.repository.PlanRepository;
import com.summit.backend.repository.SuscripcionRepository;
import com.summit.backend.repository.UsuarioRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Importa socios desde una planilla (por ejemplo, la del sistema anterior del gimnasio). Cada fila se valida como un
 * alta normal y se guarda por separado: una fila con error no frena a las demás. Un DNI que ya está registrado no se
 * toca (queda como "ya estaba"). Con plan y vencimiento, el socio queda con su membresía hasta esa fecha.
 */
@Service
@RequiredArgsConstructor
public class ImportacionSociosService {

    public static final int MAXIMO_FILAS = 2000;

    private final SocioService socioService;
    private final UsuarioRepository usuarioRepository;
    private final PlanRepository planRepository;
    private final SuscripcionRepository suscripcionRepository;
    private final Validator validator;
    private final TransactionTemplate transacciones;

    public List<ImportacionSociosDTO.Resultado> importar(List<ImportacionSociosDTO.Fila> filas) {
        if (filas == null || filas.isEmpty()) {
            throw new IllegalArgumentException("La planilla no tiene filas para importar");
        }
        if (filas.size() > MAXIMO_FILAS) {
            throw new IllegalArgumentException("Se pueden importar hasta " + MAXIMO_FILAS + " socios por vez: dividí la planilla");
        }
        Map<String, Plan> planes = planRepository.findAll().stream()
                .collect(Collectors.toMap(p -> clave(p.getNombrePlan()), p -> p, (a, b) -> a));
        Map<String, Integer> dnisVistos = new HashMap<>();
        Map<String, Integer> emailsVistos = new HashMap<>();
        List<ImportacionSociosDTO.Resultado> resultados = new ArrayList<>();

        for (int i = 0; i < filas.size(); i++) {
            ImportacionSociosDTO.Fila fila = filas.get(i);
            Integer numero = fila.numero() != null ? fila.numero() : i + 1;
            try {
                resultados.add(importarFila(fila, numero, planes, dnisVistos, emailsVistos));
            } catch (RuntimeException e) {
                resultados.add(new ImportacionSociosDTO.Resultado(numero, "ERROR", String.valueOf(e.getMessage()), null, null));
            }
        }
        return resultados;
    }

    private ImportacionSociosDTO.Resultado importarFila(ImportacionSociosDTO.Fila fila, Integer numero, Map<String, Plan> planes,
                                                         Map<String, Integer> dnisVistos, Map<String, Integer> emailsVistos) {
        String dni = fila.dni() == null ? "" : fila.dni().replaceAll("[\\s.\\-]", "");
        String email = fila.email() == null ? "" : fila.email().trim().toLowerCase(Locale.ROOT);
        if (!dni.isEmpty() && dnisVistos.containsKey(dni)) {
            return error(numero, "El DNI está repetido en la planilla (fila " + dnisVistos.get(dni) + ")");
        }
        if (!dni.isEmpty()) dnisVistos.put(dni, numero);
        if (!dni.isEmpty() && usuarioRepository.existsByDni(dni)) {
            return new ImportacionSociosDTO.Resultado(numero, "EXISTE", "Ya estaba registrado: no se modificó", null, null);
        }

        SocioRequestDTO pedido = new SocioRequestDTO(dni, texto(fila.nombreCompleto()), email, texto(fila.telefono()),
                fila.fechaNacimiento(), texto(fila.genero()), texto(fila.domicilio()), texto(fila.ciudad()),
                texto(fila.objetivo()), texto(fila.observaciones()), null);
        List<String> problemas = validator.validate(pedido).stream()
                .map(ConstraintViolation::getMessage)
                .sorted()
                .toList();
        if (!problemas.isEmpty()) {
            return error(numero, String.join(" · ", problemas));
        }
        if (emailsVistos.containsKey(email)) {
            return error(numero, "El email está repetido en la planilla (fila " + emailsVistos.get(email) + ")");
        }
        emailsVistos.put(email, numero);
        if (usuarioRepository.existsByEmail(email)) {
            return error(numero, "El email ya lo usa otra persona registrada");
        }

        // Membresía (opcional): con plan y vencimiento
        Plan plan = null;
        String aviso = null;
        if (texto(fila.plan()) != null) {
            plan = planes.get(clave(fila.plan()));
            if (plan == null) {
                aviso = "No existe el plan \"" + fila.plan().trim() + "\": quedó sin membresía";
            } else if (fila.vence() == null) {
                aviso = "Falta la fecha de vencimiento: quedó sin membresía";
                plan = null;
            }
        } else if (fila.vence() != null) {
            aviso = "Falta el plan: quedó sin membresía";
        }

        Plan planElegido = plan;
        SocioResponseDTO socio = transacciones.execute(estado -> {
            SocioResponseDTO creado = socioService.crearSocio(pedido);
            if (planElegido != null) {
                suscripcionRepository.save(Suscripcion.builder()
                        .usuario(usuarioRepository.getReferenceById(creado.idSocio()))
                        .plan(planElegido)
                        .fechaInicio(fila.vence().minusDays(planElegido.getDuracionDias()))
                        .fechaVencimiento(fila.vence())
                        .activa(true)
                        .build());
            }
            return creado;
        });
        String mensaje = planElegido != null
                ? "Importado con " + planElegido.getNombrePlan() + " hasta el " + TextoFechas.completa(fila.vence())
                : "Importado";
        return new ImportacionSociosDTO.Resultado(numero, "CREADO", mensaje, socio.idSocio(), aviso);
    }

    private static ImportacionSociosDTO.Resultado error(Integer numero, String mensaje) {
        return new ImportacionSociosDTO.Resultado(numero, "ERROR", mensaje, null, null);
    }

    private static String texto(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    // Para comparar nombres de planes sin importar mayúsculas, acentos ni espacios de más
    private static String clave(String nombre) {
        return Normalizer.normalize(nombre == null ? "" : nombre, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .trim()
                .replaceAll("\\s+", " ")
                .toLowerCase(Locale.ROOT);
    }
}
