package com.summit.backend.service;

import com.summit.backend.dto.RutinaDTO;
import com.summit.backend.dto.RutinaEjercicioDTO;
import com.summit.backend.dto.RutinaEjercicioRequestDTO;
import com.summit.backend.dto.RutinaHoyDTO;
import com.summit.backend.dto.RutinaRequestDTO;
import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.model.Ejercicio;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.LogEntrenamiento;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Rutina;
import com.summit.backend.model.RutinaEjercicio;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.CertificadoMedicoRepository;
import com.summit.backend.repository.EjercicioRepository;
import com.summit.backend.repository.LogEntrenamientoRepository;
import com.summit.backend.repository.RutinaEjercicioRepository;
import com.summit.backend.repository.RutinaRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Servicio de rutinas de entrenamiento.
 * El profesor arma la rutina del socio por días (1 a 7) con el cruce preventivo de patologías.
 * Cada socio tiene una sola rutina activa y consulta qué día le toca hoy.
 */
@Service
@RequiredArgsConstructor
public class RutinaService {

    private static final int DIAS_MAXIMOS = 7;

    // Día, posición dentro del día y, en las rutinas viejas sin posición, orden de alta
    private static final Comparator<RutinaEjercicio> POR_DIA_Y_ORDEN = Comparator
            .comparingInt(RutinaService::dia)
            .thenComparing(RutinaEjercicio::getOrden, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(RutinaEjercicio::getIdRutinaEjercicio, Comparator.nullsLast(Comparator.naturalOrder()));

    private final RutinaRepository rutinaRepository;
    private final RutinaEjercicioRepository rutinaEjercicioRepository;
    private final EjercicioRepository ejercicioRepository;
    private final UsuarioRepository usuarioRepository;
    private final CertificadoMedicoRepository certificadoMedicoRepository;
    private final LogEntrenamientoRepository logEntrenamientoRepository;

    /**
     * Rutinas activas del socio, la más reciente primero.
     */
    @Transactional(readOnly = true)
    public List<RutinaDTO> listarActivasPorSocio(Long idSocio) {
        return rutinaRepository.findBySocioIdUsuarioAndActivaTrueOrderByFechaCreacionDescIdRutinaDesc(idSocio)
                .stream().map(RutinaService::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public RutinaDTO buscarPorId(Long idRutina) {
        return toDTO(buscarRutina(idRutina));
    }

    /**
     * Crea la rutina del socio. Un socio tiene una sola rutina activa: al crear una nueva,
     * las anteriores pasan a inactivas y quedan como historial.
     */
    @Transactional
    public RutinaDTO crear(RutinaRequestDTO datos, String emailUsuario) {
        Long idSocio = datos.idSocioIndicado();
        if (idSocio == null) {
            throw new IllegalArgumentException("Indicá el socio de la rutina");
        }
        Usuario socio = usuarioRepository.findById(idSocio)
                .filter(u -> u.getRol() == Rol.SOCIO)
                .orElseThrow(() -> new IllegalArgumentException("Socio no encontrado"));
        if (socio.getEstado() != EstadoUsuario.ACTIVO) {
            throw new IllegalArgumentException("El socio no está activo");
        }

        Rutina rutina = Rutina.builder()
                .nombre(validarNombre(datos.getNombre()))
                .objetivo(validarObjetivo(datos.getObjetivo()))
                .socio(socio)
                .profesor(resolverProfesor(datos.getIdProfesor(), emailUsuario))
                .build();

        rutinaRepository.findBySocioIdUsuarioAndActivaTrue(idSocio).forEach(anterior -> anterior.setActiva(false));
        return toDTO(rutinaRepository.save(rutina));
    }

    @Transactional
    public RutinaDTO actualizar(Long idRutina, RutinaRequestDTO datos) {
        Rutina rutina = rutinaModificable(idRutina);
        if (datos.vino("nombre")) {
            rutina.setNombre(validarNombre(datos.getNombre()));
        }
        if (datos.vino("objetivo")) {
            rutina.setObjetivo(validarObjetivo(datos.getObjetivo()));
        }
        return toDTO(rutina);
    }

    /**
     * Baja lógica: la rutina y sus entrenamientos quedan como historial.
     */
    @Transactional
    public void desactivar(Long idRutina) {
        rutinaRepository.findById(idRutina)
                .orElseThrow(() -> new NoSuchElementException("Rutina no encontrada"))
                .setActiva(false);
    }

    /**
     * Agrega un ejercicio a un día de la rutina (al final del día si no se indica el orden).
     * Si el ejercicio está contraindicado para las patologías del socio, solo se agrega con forzar.
     */
    @Transactional
    public RutinaEjercicioDTO agregarEjercicio(Long idRutina, RutinaEjercicioRequestDTO datos, boolean forzar) {
        Rutina rutina = rutinaModificable(idRutina);
        Long idEjercicio = datos.idEjercicioIndicado();
        if (idEjercicio == null) {
            throw new IllegalArgumentException("Indicá el ejercicio");
        }
        Ejercicio ejercicio = ejercicioRepository.findById(idEjercicio)
                .orElseThrow(() -> new IllegalArgumentException("El ejercicio indicado no existe"));
        int dia = datos.getDiaNumero() != null ? validarDia(datos.getDiaNumero()) : 1;
        Integer posicion = validarOrden(datos.getOrden());

        RutinaEjercicio item = RutinaEjercicio.builder().rutina(rutina).ejercicio(ejercicio).build();
        aplicarDatos(item, datos, true);

        // RF-09: cruce preventivo con la ficha médica (el profesor puede forzarlo asumiendo el riesgo)
        if (!forzar) {
            List<String> riesgos = riesgosDelSocio(rutina.getSocio().getIdUsuario(), ejercicio);
            if (!riesgos.isEmpty()) {
                throw new RiesgoLesionException(riesgos);
            }
        }

        rutina.getEjercicios().add(item);
        ubicar(rutina, item, dia, posicion);
        return toDTO(rutinaEjercicioRepository.save(item));
    }

    /**
     * Edita series, repeticiones, peso, descanso u observaciones, o mueve el ejercicio
     * de día o de posición (si cambia de día y no se indica el orden, va al final).
     */
    @Transactional
    public RutinaEjercicioDTO actualizarEjercicio(Long idRutina, Long idRutinaEjercicio, RutinaEjercicioRequestDTO datos) {
        Rutina rutina = rutinaModificable(idRutina);
        RutinaEjercicio item = ejercicioDeLaRutina(rutina, idRutinaEjercicio);
        aplicarDatos(item, datos, false);

        int diaAnterior = dia(item);
        int diaNuevo = datos.getDiaNumero() != null ? validarDia(datos.getDiaNumero()) : diaAnterior;
        Integer posicion = validarOrden(datos.getOrden());
        if (diaNuevo != diaAnterior) {
            ubicar(rutina, item, diaNuevo, posicion);
            renumerarDia(rutina, diaAnterior);
        } else if (posicion != null) {
            ubicar(rutina, item, diaNuevo, posicion);
        }
        return toDTO(item);
    }

    /**
     * Quita el ejercicio de la rutina. Su historial de entrenamientos se conserva:
     * los registros guardan ejercicio, rutina y día.
     */
    @Transactional
    public void quitarEjercicio(Long idRutina, Long idRutinaEjercicio) {
        Rutina rutina = rutinaModificable(idRutina);
        RutinaEjercicio item = ejercicioDeLaRutina(rutina, idRutinaEjercicio);
        logEntrenamientoRepository.desvincularEjercicioDeRutina(idRutinaEjercicio);
        rutina.getEjercicios().remove(item);
        renumerarDia(rutina, dia(item));
    }

    /**
     * RF-09: Cruce Preventivo de Patologías.
     * Retorna las patologías del socio que contraindican el ejercicio (lista vacía si es seguro).
     */
    @Transactional(readOnly = true)
    public List<String> validarEjercicioContraindicado(Long idSocio, Long idEjercicio) {
        Ejercicio ejercicio = ejercicioRepository.findById(idEjercicio)
                .orElseThrow(() -> new IllegalArgumentException("Ejercicio no encontrado"));
        return riesgosDelSocio(idSocio, ejercicio);
    }

    /**
     * Rutina del día del socio. Si hoy ya registró algo de su rutina, sigue en ese día; si no,
     * le toca el siguiente al último que entrenó (después del último vuelve al primero);
     * si nunca entrenó, el primero. Con diaPedido se puede ver otro día.
     */
    @Transactional(readOnly = true)
    public RutinaHoyDTO rutinaDeHoy(Long idSocio, Integer diaPedido) {
        if (diaPedido != null) {
            validarDia(diaPedido);
        }
        Rutina rutina = rutinaRepository.findBySocioIdUsuarioAndActivaTrueOrderByFechaCreacionDescIdRutinaDesc(idSocio)
                .stream().findFirst()
                .orElseThrow(() -> new NoSuchElementException("El socio no tiene una rutina activa"));
        LocalDate hoy = LocalDate.now();
        List<RutinaEjercicioDTO> ejercicios = ejerciciosOrdenados(rutina);
        List<LogEntrenamiento> registrosDeHoy = logEntrenamientoRepository
                .findByRutinaIdRutinaAndFechaOrderByFechaRegistroDesc(rutina.getIdRutina(), hoy);

        int dia = diaPedido != null ? diaPedido : diaQueToca(rutina, ejercicios, registrosDeHoy, hoy);
        List<RutinaEjercicioDTO> delDia = ejercicios.stream().filter(e -> e.getDiaNumero() == dia).toList();

        // Lo cargado hoy, por ejercicio de la rutina
        Map<Long, LogEntrenamiento> deHoy = new HashMap<>();
        for (LogEntrenamiento registro : registrosDeHoy) {
            if (registro.getRutinaEjercicio() != null) {
                deHoy.putIfAbsent(registro.getRutinaEjercicio().getIdRutinaEjercicio(), registro);
            }
        }
        // La vez pasada, por ejercicio del catálogo (aunque haya sido con otra rutina)
        Set<Long> idsEjercicio = delDia.stream().map(RutinaEjercicioDTO::getIdEjercicio).collect(Collectors.toSet());
        Map<Long, LogEntrenamiento> anteriores = new HashMap<>();
        if (!idsEjercicio.isEmpty()) {
            for (LogEntrenamiento registro : logEntrenamientoRepository.findUltimosAntesDe(idSocio, idsEjercicio, hoy)) {
                anteriores.merge(registro.getEjercicio().getIdEjercicio(), registro,
                        (a, b) -> a.getFechaRegistro().isAfter(b.getFechaRegistro()) ? a : b);
            }
        }

        return RutinaHoyDTO.builder()
                .idRutina(rutina.getIdRutina())
                .nombreRutina(rutina.getNombre())
                .fecha(hoy)
                .diaNumero(dia)
                .totalDias(totalDias(ejercicios))
                .yaEntrenoHoy(!registrosDeHoy.isEmpty())
                .ejercicios(delDia.stream()
                        .map(e -> RutinaHoyDTO.EjercicioDelDia.builder()
                                .ejercicio(e)
                                .registroHoy(registroHoy(deHoy.get(e.getIdRutinaEjercicio())))
                                .ultimoRegistro(ultimoRegistro(anteriores.get(e.getIdEjercicio())))
                                .build())
                        .toList())
                .build();
    }

    /**
     * Indica si el usuario logueado (identificado por su email) es ese socio.
     */
    public boolean esElSocio(String email, Long idSocio) {
        return usuarioRepository.findByEmail(email)
                .map(u -> u.getIdUsuario().equals(idSocio))
                .orElse(false);
    }

    // ---- Mapeo a DTO ----

    public static RutinaDTO toDTO(Rutina rutina) {
        List<RutinaEjercicioDTO> ejercicios = ejerciciosOrdenados(rutina);
        Usuario profesor = rutina.getProfesor();
        return RutinaDTO.builder()
                .idRutina(rutina.getIdRutina())
                .nombre(rutina.getNombre())
                .objetivo(rutina.getObjetivo())
                .idSocio(rutina.getSocio().getIdUsuario())
                .nombreSocio(rutina.getSocio().getNombreCompleto())
                .idProfesor(profesor != null ? profesor.getIdUsuario() : null)
                .nombreProfesor(profesor != null ? profesor.getNombreCompleto() : null)
                .fechaCreacion(rutina.getFechaCreacion())
                .activa(rutina.getActiva())
                .totalDias(totalDias(ejercicios))
                .ejercicios(ejercicios)
                .build();
    }

    public static RutinaEjercicioDTO toDTO(RutinaEjercicio item) {
        Ejercicio ejercicio = item.getEjercicio();
        return RutinaEjercicioDTO.builder()
                .idRutinaEjercicio(item.getIdRutinaEjercicio())
                .idEjercicio(ejercicio.getIdEjercicio())
                .nombreEjercicio(ejercicio.getNombre())
                .grupoMuscular(ejercicio.getGrupoMuscular() != null ? ejercicio.getGrupoMuscular().name() : null)
                .urlMedia(ejercicio.getUrlMedia())
                .diaNumero(dia(item))
                .orden(item.getOrden())
                .series(item.getSeries())
                .repeticiones(item.getRepeticiones())
                .pesoSugeridoKg(item.getPesoSugeridoKg())
                .descansoSegundos(item.getDescansoSegundos())
                .observaciones(item.getObservaciones())
                .build();
    }

    // Las rutinas armadas antes de existir los días tienen el día vacío: cuentan como día 1
    static int dia(RutinaEjercicio item) {
        return item.getDiaNumero() != null ? item.getDiaNumero() : 1;
    }

    /**
     * Ejercicios ordenados por día y orden. Las rutinas cargadas antes de existir el orden
     * no lo tienen guardado: se informa la posición dentro del día.
     */
    private static List<RutinaEjercicioDTO> ejerciciosOrdenados(Rutina rutina) {
        Map<Integer, Integer> posicionEnElDia = new HashMap<>();
        List<RutinaEjercicioDTO> ejercicios = new ArrayList<>();
        for (RutinaEjercicio item : rutina.getEjercicios().stream().sorted(POR_DIA_Y_ORDEN).toList()) {
            RutinaEjercicioDTO dto = toDTO(item);
            int posicion = posicionEnElDia.merge(dto.getDiaNumero(), 1, Integer::sum);
            if (dto.getOrden() == null) {
                dto.setOrden(posicion);
            }
            ejercicios.add(dto);
        }
        return ejercicios;
    }

    private static int totalDias(List<RutinaEjercicioDTO> ejercicios) {
        return ejercicios.stream().mapToInt(RutinaEjercicioDTO::getDiaNumero).max().orElse(0);
    }

    private static RutinaHoyDTO.RegistroHoy registroHoy(LogEntrenamiento registro) {
        if (registro == null) return null;
        return RutinaHoyDTO.RegistroHoy.builder()
                .idLog(registro.getIdLog())
                .pesoKg(registro.getPesoKg())
                .repeticiones(registro.getRepeticiones())
                .series(registro.getSeries())
                .rpe(registro.getRpe())
                .comentario(registro.getComentario())
                .build();
    }

    private static RutinaHoyDTO.UltimoRegistro ultimoRegistro(LogEntrenamiento registro) {
        if (registro == null) return null;
        return RutinaHoyDTO.UltimoRegistro.builder()
                .fecha(registro.getFecha())
                .pesoKg(registro.getPesoKg())
                .repeticiones(registro.getRepeticiones())
                .series(registro.getSeries())
                .rpe(registro.getRpe())
                .build();
    }

    // ---- Reglas internas ----

    private Rutina buscarRutina(Long idRutina) {
        return rutinaRepository.findConDetalleByIdRutina(idRutina)
                .orElseThrow(() -> new NoSuchElementException("Rutina no encontrada"));
    }

    // Las rutinas desactivadas quedan como historial: no se editan (se crea una nueva)
    private Rutina rutinaModificable(Long idRutina) {
        Rutina rutina = buscarRutina(idRutina);
        if (!Boolean.TRUE.equals(rutina.getActiva())) {
            throw new IllegalArgumentException("La rutina está desactivada: no se puede modificar");
        }
        return rutina;
    }

    private static RutinaEjercicio ejercicioDeLaRutina(Rutina rutina, Long idRutinaEjercicio) {
        return rutina.getEjercicios().stream()
                .filter(e -> e.getIdRutinaEjercicio().equals(idRutinaEjercicio))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("El ejercicio no forma parte de esta rutina"));
    }

    // Si la crea un PROFESOR, es él; si la crea un ADMIN, puede indicar el profesor a cargo (opcional)
    private Usuario resolverProfesor(Long idProfesor, String emailUsuario) {
        Usuario actual = usuarioRepository.findByEmail(emailUsuario)
                .orElseThrow(() -> new IllegalStateException("Usuario no encontrado"));
        if (actual.getRol() == Rol.PROFESOR) {
            return actual;
        }
        if (idProfesor == null) {
            return null;
        }
        return usuarioRepository.findById(idProfesor)
                .filter(u -> u.getRol() == Rol.PROFESOR && u.getEstado() == EstadoUsuario.ACTIVO)
                .orElseThrow(() -> new IllegalArgumentException("El profesor indicado no existe o no está activo"));
    }

    private int diaQueToca(Rutina rutina, List<RutinaEjercicioDTO> ejercicios,
                           List<LogEntrenamiento> registrosDeHoy, LocalDate hoy) {
        if (!registrosDeHoy.isEmpty()) {
            return registrosDeHoy.get(0).getDiaNumero();
        }
        // Días con ejercicios en orden (puede haber días salteados, ej. 1, 2 y 4)
        List<Integer> dias = ejercicios.stream().map(RutinaEjercicioDTO::getDiaNumero).distinct().toList();
        if (dias.isEmpty()) {
            return 1;
        }
        return logEntrenamientoRepository
                .findFirstByRutinaIdRutinaAndFechaBeforeOrderByFechaDescFechaRegistroDesc(rutina.getIdRutina(), hoy)
                .map(ultimo -> dias.stream().filter(d -> d > ultimo.getDiaNumero()).findFirst().orElse(dias.get(0)))
                .orElse(dias.get(0));
    }

    /**
     * Compara las patologías del último certificado médico del socio con las contraindicaciones del
     * ejercicio, sin distinguir mayúsculas ni tildes ("Hernia de disco" coincide con "HERNIA").
     */
    private List<String> riesgosDelSocio(Long idSocio, Ejercicio ejercicio) {
        String contraindicadas = ejercicio.getPatologiasContraindicadas();
        if (contraindicadas == null || contraindicadas.isBlank()) {
            return List.of();
        }
        String patologias = certificadoMedicoRepository.findFirstByUsuarioIdUsuarioOrderByFechaVencimientoDesc(idSocio)
                .map(CertificadoMedico::getObservacionesPatologias)
                .orElse(null);
        if (patologias == null || patologias.isBlank()) {
            return List.of();
        }

        List<String> contraindicaciones = Arrays.stream(contraindicadas.split(","))
                .map(RutinaService::normalizar).filter(c -> !c.isEmpty()).toList();
        List<String> riesgos = new ArrayList<>();
        for (String patologia : patologias.split(",")) {
            String p = normalizar(patologia);
            if (!p.isEmpty() && contraindicaciones.stream().anyMatch(p::contains)) {
                riesgos.add(patologia.trim().toUpperCase());
            }
        }
        return riesgos;
    }

    private static String normalizar(String texto) {
        return Normalizer.normalize(texto.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "").toUpperCase();
    }

    /**
     * Ubica el ejercicio en el día y la posición pedidos (al final si no se indica)
     * y deja el orden de ese día como 1, 2, 3...
     */
    private static void ubicar(Rutina rutina, RutinaEjercicio item, int dia, Integer posicion) {
        List<RutinaEjercicio> delDia = rutina.getEjercicios().stream()
                .filter(e -> e != item && dia(e) == dia)
                .sorted(POR_DIA_Y_ORDEN)
                .collect(Collectors.toCollection(ArrayList::new));
        int indice = posicion == null ? delDia.size() : Math.min(posicion, delDia.size() + 1) - 1;
        delDia.add(indice, item);
        item.setDiaNumero(dia);
        renumerar(delDia);
    }

    private static void renumerarDia(Rutina rutina, int dia) {
        renumerar(rutina.getEjercicios().stream().filter(e -> dia(e) == dia).sorted(POR_DIA_Y_ORDEN).toList());
    }

    private static void renumerar(List<RutinaEjercicio> delDia) {
        for (int i = 0; i < delDia.size(); i++) {
            RutinaEjercicio item = delDia.get(i);
            item.setDiaNumero(dia(item)); // las rutinas viejas guardan el día 1 explícito
            item.setOrden(i + 1);
        }
    }

    // ---- Validaciones (los rangos de series, repeticiones y peso valen también para los entrenamientos) ----

    // En el alta se validan todos los datos; en la edición, solo los que vinieron en el JSON
    private static void aplicarDatos(RutinaEjercicio item, RutinaEjercicioRequestDTO datos, boolean esAlta) {
        if (esAlta || datos.vino("series")) {
            item.setSeries(validarSeries(obligatorio(datos.getSeries(), "Indicá las series")));
        }
        if (esAlta || datos.vino("repeticiones")) {
            item.setRepeticiones(validarRepeticiones(obligatorio(datos.getRepeticiones(), "Indicá las repeticiones")));
        }
        if (esAlta || datos.vino("pesoSugeridoKg")) {
            item.setPesoSugeridoKg(validarPeso(datos.getPesoSugeridoKg()));
        }
        if (esAlta || datos.vino("descansoSegundos")) {
            item.setDescansoSegundos(enRango(datos.getDescansoSegundos(), 0, 600,
                    "El descanso debe ser de 0 a 600 segundos"));
        }
        if (esAlta || datos.vino("observaciones")) {
            item.setObservaciones(textoOpcional(datos.getObservaciones(), 300,
                    "Las observaciones no pueden superar los 300 caracteres"));
        }
    }

    static Integer validarSeries(Integer series) {
        return enRango(series, 1, 20, "Las series deben ser de 1 a 20");
    }

    static Integer validarRepeticiones(Integer repeticiones) {
        return enRango(repeticiones, 1, 100, "Las repeticiones deben ser de 1 a 100");
    }

    static Double validarPeso(Double pesoKg) {
        // Comparación negada: también rechaza NaN
        if (pesoKg != null && !(pesoKg >= 0 && pesoKg <= 500)) {
            throw new IllegalArgumentException("El peso debe ser de 0 a 500 kg");
        }
        return pesoKg;
    }

    static String textoOpcional(String texto, int maximo, String error) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        if (texto.trim().length() > maximo) {
            throw new IllegalArgumentException(error);
        }
        return texto.trim();
    }

    private static Integer enRango(Integer valor, int minimo, int maximo, String error) {
        if (valor != null && (valor < minimo || valor > maximo)) {
            throw new IllegalArgumentException(error);
        }
        return valor;
    }

    private static <T> T obligatorio(T valor, String error) {
        if (valor == null) {
            throw new IllegalArgumentException(error);
        }
        return valor;
    }

    private static String validarNombre(String nombre) {
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("El nombre de la rutina es obligatorio");
        }
        return textoOpcional(nombre, 100, "El nombre de la rutina no puede superar los 100 caracteres");
    }

    private static String validarObjetivo(String objetivo) {
        return textoOpcional(objetivo, 255, "El objetivo no puede superar los 255 caracteres");
    }

    private static int validarDia(int dia) {
        if (dia < 1 || dia > DIAS_MAXIMOS) {
            throw new IllegalArgumentException("El día debe ser de 1 a " + DIAS_MAXIMOS);
        }
        return dia;
    }

    private static Integer validarOrden(Integer orden) {
        if (orden != null && orden < 1) {
            throw new IllegalArgumentException("El orden debe ser 1 o mayor");
        }
        return orden;
    }

    /**
     * El ejercicio está contraindicado para el socio: el profesor puede agregarlo igual con forzar=true.
     */
    @Getter
    public static class RiesgoLesionException extends IllegalArgumentException {
        private final List<String> riesgos;

        public RiesgoLesionException(List<String> riesgos) {
            super("Riesgo de lesión detectado. Patologías contraindicadas: " + String.join(", ", riesgos));
            this.riesgos = riesgos;
        }
    }
}
