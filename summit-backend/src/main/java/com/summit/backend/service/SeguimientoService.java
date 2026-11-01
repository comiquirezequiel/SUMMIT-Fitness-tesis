package com.summit.backend.service;

import com.summit.backend.dto.ContactoRequestDTO;
import com.summit.backend.dto.InactividadDTO;
import com.summit.backend.dto.TareaDTO;
import com.summit.backend.dto.TareaRequestDTO;
import com.summit.backend.model.CanalContacto;
import com.summit.backend.model.EstadoDebito;
import com.summit.backend.model.EstadoTarea;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Rol;
import com.summit.backend.model.TareaSeguimiento;
import com.summit.backend.model.TipoTarea;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.CertificadoMedicoRepository;
import com.summit.backend.repository.DebitoAutomaticoRepository;
import com.summit.backend.repository.LogAsistenciaRepository;
import com.summit.backend.repository.SuscripcionRepository;
import com.summit.backend.repository.TareaSeguimientoRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Seguimiento de socios: quiénes dejaron de venir (inactividad) y las tareas para contactarlos.
 *
 * <p>Las tareas automáticas se generan cada hora (y cuando recepción toca "Actualizar"): cuota por vencer (sin débito
 * automático), cuota vencida hace poco, apto médico por vencer (si el gimnasio lo exige) y socio con la cuota al día
 * que hace 15 días o más que no viene. La misma situación no genera dos tareas (clave única), y una pendiente se
 * resuelve sola cuando el socio renueva, trae el apto nuevo o vuelve al gimnasio.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SeguimientoService {

    // Niveles de inactividad (días sin venir)
    private static final int DIAS_LEVE = 7;
    private static final int DIAS_MEDIO = 15;
    private static final int DIAS_ALTO = 30;
    // La lista de inactividad incluye a los que tienen la cuota vencida hace hasta estos días (todavía se los recupera)
    private static final int DIAS_CUOTA_VENCIDA_EN_LISTA = 30;

    // Ventanas de las tareas automáticas
    // La cuota por vencer no genera tarea (la tarea llega si vence sin renovar); el apto por vencer, a una semana
    private static final int DIAS_TAREA_CUOTA_VENCIDA = 15;
    private static final int DIAS_AVISO_APTO = 7;

    private static final int DIAS_PROMEDIO = 90;

    private final UsuarioRepository usuarioRepository;
    private final SuscripcionRepository suscripcionRepository;
    private final LogAsistenciaRepository logAsistenciaRepository;
    private final CertificadoMedicoRepository certificadoMedicoRepository;
    private final DebitoAutomaticoRepository debitoAutomaticoRepository;
    private final TareaSeguimientoRepository tareaRepository;
    private final CongelamientoService congelamientoService;
    private final ConfiguracionAccesoService configService;

    /** Lo que importa de un socio activo para el seguimiento. */
    private record EstadoSocio(Usuario socio, String plan, LocalDate vencimiento, LocalDateTime ultimoIngreso,
                               int ingresos90, LocalDate vencimientoApto, boolean congelado, boolean debitoActivo) {

        // Días sin venir; si nunca vino, desde el alta
        long diasSinVenir(LocalDate hoy) {
            LocalDate desde = ultimoIngreso != null ? ultimoIngreso.toLocalDate() : socio.getFechaCreacion().toLocalDate();
            return ChronoUnit.DAYS.between(desde, hoy);
        }

        boolean alDia(LocalDate hoy) {
            return vencimiento != null && !vencimiento.isBefore(hoy);
        }
    }

    // ---- Inactividad ----

    /** Socios con la cuota al día (o vencida hace poco), sin congelar, que hace minDias o más que no vienen. */
    @Transactional(readOnly = true)
    public InactividadDTO inactividad(int minDias) {
        LocalDate hoy = LocalDate.now();
        List<EstadoSocio> estados = estados(hoy);
        Map<Long, LocalDateTime> ultimoContacto = filasAMapa(tareaRepository.ultimoContactoPorSocio());
        Map<Long, Long> tareaPendiente = new HashMap<>();
        for (TareaSeguimiento t : tareaRepository.findByEstadoOrderByVenceAscIdTareaAsc(EstadoTarea.PENDIENTE)) {
            if (t.getTipo() == TipoTarea.INACTIVO) tareaPendiente.putIfAbsent(t.getUsuario().getIdUsuario(), t.getIdTarea());
        }

        int alDia = 0;
        int vinieronSemana = 0;
        int[] niveles = new int[3];
        List<InactividadDTO.Socio> socios = new ArrayList<>();
        for (EstadoSocio e : estados) {
            if (e.congelado()) continue;
            if (e.alDia(hoy)) {
                alDia++;
                if (e.ultimoIngreso() != null && e.diasSinVenir(hoy) < 7) vinieronSemana++;
            }
            boolean enLista = e.vencimiento() != null
                    && !e.vencimiento().isBefore(hoy.minusDays(DIAS_CUOTA_VENCIDA_EN_LISTA));
            long dias = e.diasSinVenir(hoy);
            if (!enLista || dias < Math.max(minDias, DIAS_LEVE)) continue;
            String nivel = dias >= DIAS_ALTO ? "ALTO" : dias >= DIAS_MEDIO ? "MEDIO" : "LEVE";
            niveles[nivel.equals("ALTO") ? 2 : nivel.equals("MEDIO") ? 1 : 0]++;
            Usuario s = e.socio();
            socios.add(new InactividadDTO.Socio(s.getIdUsuario(), s.getNombreCompleto(), s.getDni(), s.getTelefono(),
                    s.getEmail(), e.plan(), e.vencimiento(), e.ultimoIngreso(), dias, e.ingresos90(),
                    Math.round(e.ingresos90() * 70.0 / DIAS_PROMEDIO) / 10.0, nivel,
                    ultimoContacto.get(s.getIdUsuario()), tareaPendiente.get(s.getIdUsuario())));
        }
        socios.sort(Comparator.comparingLong(InactividadDTO.Socio::diasSinVenir).reversed());
        return InactividadDTO.builder()
                .leve(niveles[0]).medio(niveles[1]).alto(niveles[2])
                .sociosAlDia(alDia).vinieronSemana(vinieronSemana)
                .socios(socios)
                .build();
    }

    // ---- Tareas automáticas ----

    /**
     * Resuelve las tareas pendientes cuya situación ya cambió y crea las que faltan. Sin transacción de conjunto: cada
     * tarea se guarda por separado, y si otra corrida acaba de crear la misma (clave única), se saltea.
     *
     * @return cuántas tareas creó y cuántas se resolvieron solas
     */
    @Scheduled(cron = "0 5 * * * *")
    public synchronized Map<String, Integer> generarTareas() {
        LocalDate hoy = LocalDate.now();
        LocalDateTime ahora = LocalDateTime.now();
        List<EstadoSocio> estados = estados(hoy);
        Map<Long, EstadoSocio> porSocio = estados.stream()
                .collect(Collectors.toMap(e -> e.socio().getIdUsuario(), e -> e));

        int resueltas = 0;
        for (TareaSeguimiento tarea : tareaRepository.findByEstadoAndTipoNot(EstadoTarea.PENDIENTE, TipoTarea.MANUAL)) {
            // Avisos que ya no se usan (cuota por vencer) o creados antes de su ventana (apto con más de una semana): se
            // borran; el del apto vuelve a crearse, con la misma clave, cuando falte una semana
            if (sobra(tarea, hoy)) {
                tareaRepository.delete(tarea);
                continue;
            }
            EstadoSocio e = porSocio.get(tarea.getUsuario().getIdUsuario());
            String motivo = motivoResuelta(tarea, e, hoy);
            if (motivo != null) {
                tarea.setEstado(e == null ? EstadoTarea.DESCARTADA : EstadoTarea.RESUELTA);
                tarea.setNota(motivo);
                tarea.setFechaResolucion(ahora);
                tareaRepository.save(tarea);
                resueltas++;
            }
        }

        boolean exigeApto = configService.obtenerConfiguracionGlobal().isRequerirCertificadoMedico();
        int creadas = 0;
        for (EstadoSocio e : estados) {
            for (TareaSeguimiento nueva : tareasPara(e, hoy, exigeApto)) {
                if (tareaRepository.existsByClave(nueva.getClave())) continue;
                try {
                    tareaRepository.save(nueva);
                    creadas++;
                } catch (DataIntegrityViolationException duplicada) {
                    // otra corrida la creó recién
                }
            }
        }
        if (creadas > 0 || resueltas > 0) {
            log.info("Seguimiento: {} tareas nuevas, {} resueltas solas", creadas, resueltas);
        }
        Map<String, Integer> resultado = new LinkedHashMap<>();
        resultado.put("creadas", creadas);
        resultado.put("resueltas", resueltas);
        return resultado;
    }

    private static boolean sobra(TareaSeguimiento tarea, LocalDate hoy) {
        LocalDate referencia = tarea.getFechaReferencia();
        return switch (tarea.getTipo()) {
            case CUOTA_POR_VENCER -> true;
            case APTO_POR_VENCER -> referencia != null && referencia.isAfter(hoy.plusDays(DIAS_AVISO_APTO));
            default -> false;
        };
    }

    // Por qué una tarea pendiente ya no hace falta (null si sigue haciendo falta)
    private static String motivoResuelta(TareaSeguimiento tarea, EstadoSocio e, LocalDate hoy) {
        if (e == null) return "El socio ya no está activo";
        LocalDate referencia = tarea.getFechaReferencia();
        return switch (tarea.getTipo()) {
            case CUOTA_POR_VENCER, CUOTA_VENCIDA -> {
                if (e.vencimiento() != null && referencia != null && e.vencimiento().isAfter(referencia)) {
                    yield "Renovó la cuota: ahora vence el " + TextoFechas.completa(e.vencimiento());
                }
                yield tarea.getTipo() == TipoTarea.CUOTA_POR_VENCER && referencia != null && hoy.isAfter(referencia)
                        ? "Venció sin renovar: sigue como cuota vencida" : null;
            }
            case APTO_POR_VENCER -> e.vencimientoApto() != null && referencia != null && e.vencimientoApto().isAfter(referencia)
                    ? "Trajo un apto nuevo: vence el " + TextoFechas.completa(e.vencimientoApto()) : null;
            case INACTIVO -> e.ultimoIngreso() != null
                    && (referencia == null || e.ultimoIngreso().toLocalDate().isAfter(referencia))
                    ? "Volvió al gimnasio el " + TextoFechas.completa(e.ultimoIngreso().toLocalDate()) : null;
            case MANUAL -> null;
        };
    }

    // Las tareas automáticas que corresponden hoy a un socio
    private static List<TareaSeguimiento> tareasPara(EstadoSocio e, LocalDate hoy, boolean exigeApto) {
        List<TareaSeguimiento> tareas = new ArrayList<>();
        Long id = e.socio().getIdUsuario();
        LocalDate vence = e.vencimiento();
        if (vence != null) {
            long dias = ChronoUnit.DAYS.between(hoy, vence);
            if (dias < 0 && -dias <= DIAS_TAREA_CUOTA_VENCIDA) {
                tareas.add(tarea(e, TipoTarea.CUOTA_VENCIDA, "VENCIDA:" + id + ":" + vence, hoy, vence,
                        "La cuota (" + e.plan() + ") venció el " + TextoFechas.completa(vence) + " y no renovó: invitarlo a volver"));
            }
        }
        if (exigeApto && e.vencimientoApto() != null) {
            long dias = ChronoUnit.DAYS.between(hoy, e.vencimientoApto());
            if (dias >= 0 && dias <= DIAS_AVISO_APTO) {
                tareas.add(tarea(e, TipoTarea.APTO_POR_VENCER, "APTO:" + id + ":" + e.vencimientoApto(), e.vencimientoApto(),
                        e.vencimientoApto(), "El apto médico vence el " + TextoFechas.completa(e.vencimientoApto())
                                + ": pedirle uno nuevo"));
            }
        }
        if (!e.congelado() && e.alDia(hoy) && e.diasSinVenir(hoy) >= DIAS_MEDIO) {
            LocalDate ultimo = e.ultimoIngreso() != null ? e.ultimoIngreso().toLocalDate() : null;
            tareas.add(tarea(e, TipoTarea.INACTIVO, "INACTIVO:" + id + ":" + (ultimo != null ? ultimo : "nunca"), hoy, ultimo,
                    ultimo != null
                            ? "Hace " + e.diasSinVenir(hoy) + " días que no viene (último ingreso: " + TextoFechas.completa(ultimo) + ")"
                            : "Tiene la cuota paga y todavía no vino (alta: "
                            + TextoFechas.completa(e.socio().getFechaCreacion().toLocalDate()) + ")"));
        }
        return tareas;
    }

    private static TareaSeguimiento tarea(EstadoSocio e, TipoTarea tipo, String clave, LocalDate vence, LocalDate referencia,
                                          String descripcion) {
        return TareaSeguimiento.builder()
                .usuario(e.socio())
                .tipo(tipo)
                .clave(clave)
                .vence(vence)
                .fechaReferencia(referencia)
                .descripcion(descripcion)
                .build();
    }

    // ---- Tareas: listado y acciones del equipo ----

    @Transactional(readOnly = true)
    public List<TareaDTO> pendientes() {
        return tareaRepository.findByEstadoOrderByVenceAscIdTareaAsc(EstadoTarea.PENDIENTE).stream().map(this::aDto).toList();
    }

    /** Las últimas tareas resueltas (hechas, descartadas o que se resolvieron solas). */
    @Transactional(readOnly = true)
    public List<TareaDTO> resueltas(int cantidad) {
        return tareaRepository.findByEstadoInOrderByFechaResolucionDescIdTareaDesc(
                        EnumSet.of(EstadoTarea.HECHA, EstadoTarea.DESCARTADA, EstadoTarea.RESUELTA), PageRequest.of(0, cantidad))
                .stream().map(this::aDto).toList();
    }

    /** Para el aviso del menú: cuántas tareas hay pendientes y cuántas ya se pasaron de fecha. */
    public Map<String, Long> cantidades() {
        return Map.of("pendientes", tareaRepository.countByEstado(EstadoTarea.PENDIENTE),
                "atrasadas", tareaRepository.countByEstadoAndVenceLessThan(EstadoTarea.PENDIENTE, LocalDate.now()));
    }

    @Transactional
    public TareaDTO crear(TareaRequestDTO pedido, String email) {
        Usuario socio = socio(pedido.idSocio());
        LocalDate vence = pedido.vence() != null ? pedido.vence() : LocalDate.now();
        if (vence.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("La fecha de la tarea no puede ser anterior a hoy");
        }
        return aDto(tareaRepository.save(TareaSeguimiento.builder()
                .usuario(socio)
                .tipo(TipoTarea.MANUAL)
                .descripcion(pedido.descripcion().trim())
                .vence(vence)
                .creadaPor(usuarioPorEmail(email))
                .build()));
    }

    /** Marca una tarea pendiente como hecha (con el canal y qué pasó) o descartada. */
    @Transactional
    public TareaDTO resolver(Long idTarea, ContactoRequestDTO pedido, String email) {
        TareaSeguimiento tarea = tareaRepository.findById(idTarea)
                .orElseThrow(() -> new NoSuchElementException("No existe la tarea " + idTarea));
        if (tarea.getEstado() != EstadoTarea.PENDIENTE) {
            throw new IllegalStateException("Esa tarea ya no está pendiente");
        }
        if (pedido.estado() != EstadoTarea.HECHA && pedido.estado() != EstadoTarea.DESCARTADA) {
            throw new IllegalArgumentException("Indicá si la tarea se hizo o se descarta");
        }
        if (pedido.estado() == EstadoTarea.HECHA && pedido.canal() == null) {
            throw new IllegalArgumentException("Indicá cómo se contactó al socio");
        }
        tarea.setEstado(pedido.estado());
        tarea.setCanal(pedido.estado() == EstadoTarea.HECHA ? pedido.canal() : null);
        tarea.setNota(textoOpcional(pedido.nota()));
        tarea.setResueltaPor(usuarioPorEmail(email));
        tarea.setFechaResolucion(LocalDateTime.now());
        return aDto(tareaRepository.save(tarea));
    }

    /**
     * Registra que se contactó a un socio inactivo: hace su tarea de inactividad pendiente o, si no tiene, deja una
     * hecha como registro del contacto.
     */
    @Transactional
    public TareaDTO registrarContacto(ContactoRequestDTO pedido, String email) {
        if (pedido.idSocio() == null) {
            throw new IllegalArgumentException("Falta el socio");
        }
        CanalContacto canal = pedido.canal() != null ? pedido.canal() : CanalContacto.WHATSAPP;
        Usuario socio = socio(pedido.idSocio());
        TareaSeguimiento tarea = tareaRepository
                .findFirstByUsuarioIdUsuarioAndTipoAndEstadoOrderByIdTareaDesc(socio.getIdUsuario(), TipoTarea.INACTIVO, EstadoTarea.PENDIENTE)
                .orElseGet(() -> TareaSeguimiento.builder()
                        .usuario(socio)
                        .tipo(TipoTarea.INACTIVO)
                        .descripcion("Contacto por inactividad")
                        .vence(LocalDate.now())
                        .creadaPor(usuarioPorEmail(email))
                        .build());
        tarea.setEstado(EstadoTarea.HECHA);
        tarea.setCanal(canal);
        tarea.setNota(textoOpcional(pedido.nota()));
        tarea.setResueltaPor(usuarioPorEmail(email));
        tarea.setFechaResolucion(LocalDateTime.now());
        return aDto(tareaRepository.save(tarea));
    }

    // ---- Comunes ----

    // Socios activos con su membresía, último ingreso, ingresos de los últimos 90 días, apto, congelamiento y débito
    private List<EstadoSocio> estados(LocalDate hoy) {
        Map<Long, LocalDate> vencimientos = new HashMap<>();
        Map<Long, String> planes = new HashMap<>();
        for (Object[] fila : suscripcionRepository.vencimientosConPlan()) {
            Long id = (Long) fila[0];
            LocalDate vence = (LocalDate) fila[3];
            if (!vencimientos.containsKey(id) || vence.isAfter(vencimientos.get(id))) {
                vencimientos.put(id, vence);
                planes.put(id, (String) fila[1]);
            }
        }
        Map<Long, LocalDateTime> ultimos = filasAMapa(logAsistenciaRepository.ultimoIngresoPorSocio());
        Map<Long, Set<LocalDate>> dias90 = new HashMap<>();
        for (Object[] fila : logAsistenciaRepository.ingresosDeSocios(hoy.minusDays(DIAS_PROMEDIO).atStartOfDay(),
                hoy.plusDays(1).atStartOfDay())) {
            dias90.computeIfAbsent((Long) fila[1], k -> new HashSet<>()).add(((LocalDateTime) fila[0]).toLocalDate());
        }
        Map<Long, LocalDate> aptos = new HashMap<>();
        for (Object[] fila : certificadoMedicoRepository.vencimientoAptoPorSocio()) {
            aptos.put((Long) fila[0], (LocalDate) fila[1]);
        }
        Set<Long> congelados = congelamientoService.congeladosHoy().keySet();
        Set<Long> conDebito = debitoAutomaticoRepository.findByEstadoInOrderByFechaAltaDesc(List.of(EstadoDebito.ACTIVO)).stream()
                .map(d -> d.getUsuario().getIdUsuario())
                .collect(Collectors.toSet());

        return usuarioRepository.findByRol(Rol.SOCIO).stream()
                .filter(u -> u.getEstado() == EstadoUsuario.ACTIVO)
                .map(u -> new EstadoSocio(u, planes.get(u.getIdUsuario()), vencimientos.get(u.getIdUsuario()),
                        ultimos.get(u.getIdUsuario()), dias90.getOrDefault(u.getIdUsuario(), Set.of()).size(),
                        aptos.get(u.getIdUsuario()), congelados.contains(u.getIdUsuario()), conDebito.contains(u.getIdUsuario())))
                .toList();
    }

    private static Map<Long, LocalDateTime> filasAMapa(List<Object[]> filas) {
        Map<Long, LocalDateTime> mapa = new HashMap<>();
        for (Object[] fila : filas) {
            if (fila[1] != null) mapa.put((Long) fila[0], (LocalDateTime) fila[1]);
        }
        return mapa;
    }

    private Usuario socio(Long idSocio) {
        return usuarioRepository.findById(idSocio)
                .filter(u -> u.getRol() == Rol.SOCIO)
                .orElseThrow(() -> new NoSuchElementException("Socio no encontrado"));
    }

    private Usuario usuarioPorEmail(String email) {
        return email == null ? null : usuarioRepository.findByEmail(email).orElse(null);
    }

    private static String textoOpcional(String texto) {
        return texto == null || texto.isBlank() ? null : texto.trim();
    }

    private TareaDTO aDto(TareaSeguimiento t) {
        Usuario s = t.getUsuario();
        return TareaDTO.builder()
                .idTarea(t.getIdTarea())
                .idSocio(s.getIdUsuario())
                .nombreSocio(s.getNombreCompleto())
                .dniSocio(s.getDni())
                .telefonoSocio(s.getTelefono())
                .tipo(t.getTipo().name())
                .descripcion(t.getDescripcion())
                .vence(t.getVence())
                .fechaReferencia(t.getFechaReferencia())
                .estado(t.getEstado().name())
                .canal(t.getCanal() != null ? t.getCanal().name() : null)
                .nota(t.getNota())
                .creadaPor(t.getCreadaPor() != null ? t.getCreadaPor().getNombreCompleto() : null)
                .fechaCreacion(t.getFechaCreacion())
                .resueltaPor(t.getResueltaPor() != null ? t.getResueltaPor().getNombreCompleto() : null)
                .fechaResolucion(t.getFechaResolucion())
                .build();
    }
}
