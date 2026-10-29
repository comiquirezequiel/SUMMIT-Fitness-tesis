package com.summit.backend.service;

import com.summit.backend.dto.RutinaDTO;
import com.summit.backend.dto.RutinaEjercicioDTO;
import com.summit.backend.dto.RutinaEjercicioRequestDTO;
import com.summit.backend.dto.RutinaRequestDTO;
import com.summit.backend.dto.RutinaResumenDTO;
import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.model.Ejercicio;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Rutina;
import com.summit.backend.model.RutinaEjercicio;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.CertificadoMedicoRepository;
import com.summit.backend.repository.EjercicioRepository;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
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

    /**
     * Rutinas activas del socio, la más reciente primero.
     */
    @Transactional(readOnly = true)
    public List<RutinaDTO> listarActivasPorSocio(Long idSocio) {
        return rutinaRepository.findBySocioIdUsuarioAndActivaTrueOrderByFechaCreacionDescIdRutinaDesc(idSocio)
                .stream().map(RutinaService::toDTO).toList();
    }

    /**
     * Rutinas activas de todos los socios (listado del personal), por socio, en una sola consulta.
     */
    @Transactional(readOnly = true)
    public List<RutinaResumenDTO> listarActivas() {
        return rutinaRepository.resumenActivas().stream()
                .map(fila -> RutinaResumenDTO.builder()
                        .idRutina((Long) fila[0])
                        .nombre((String) fila[1])
                        .objetivo((String) fila[2])
                        .idSocio((Long) fila[3])
                        .nombreSocio((String) fila[4])
                        .idProfesor((Long) fila[5])
                        .nombreProfesor((String) fila[6])
                        .fechaCreacion((LocalDate) fila[7])
                        .totalDias(fila[8] != null ? ((Number) fila[8]).intValue() : 0)
                        .cantidadEjercicios(((Number) fila[9]).longValue())
                        .build())
                .toList();
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
     * Quita el ejercicio de la rutina.
     */
    @Transactional
    public void quitarEjercicio(Long idRutina, Long idRutinaEjercicio) {
        Rutina rutina = rutinaModificable(idRutina);
        RutinaEjercicio item = ejercicioDeLaRutina(rutina, idRutinaEjercicio);
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

    /**
     * Compara las patologías del último certificado médico del socio con las contraindicaciones del
     * ejercicio, sin distinguir mayúsculas ni tildes ("Hernia de disco" coincide con "HERNIA").
     */
    /**
     * Ejercicios del catálogo contraindicados para el socio según la regla firme (patologías de su
     * certificado contra las contraindicaciones de cada ejercicio): idEjercicio -> patologías en riesgo.
     *
     * <p>Agregado para la IA: AsistenteIaService.ejerciciosAEvitar(...) combina este resultado (determinístico,
     * siempre igual para los mismos datos) con lo que sugiere el modelo, y marca cada ejercicio como REGLA,
     * IA o AMBOS. Lee el certificado UNA sola vez y recorre todo el catálogo (en lugar de una consulta por ejercicio).</p>
     */
    @Transactional(readOnly = true)
    public Map<Long, List<String>> contraindicadosPorRegla(Long idSocio) {
        String patologias = patologiasDelSocio(idSocio);
        Map<Long, List<String>> resultado = new LinkedHashMap<>();
        for (Ejercicio ejercicio : ejercicioRepository.findAll()) {
            List<String> riesgos = riesgos(patologias, ejercicio.getPatologiasContraindicadas());
            if (!riesgos.isEmpty()) {
                resultado.put(ejercicio.getIdEjercicio(), riesgos);
            }
        }
        return resultado;
    }

    private List<String> riesgosDelSocio(Long idSocio, Ejercicio ejercicio) {
        String contraindicadas = ejercicio.getPatologiasContraindicadas();
        if (contraindicadas == null || contraindicadas.isBlank()) {
            return List.of();
        }
        return riesgos(patologiasDelSocio(idSocio), contraindicadas);
    }

    // Patologías del certificado actual (el de vencimiento más lejano). Separado en un método para que lo usen
    // tanto la validación de un ejercicio como el recorrido de todo el catálogo.
    private String patologiasDelSocio(Long idSocio) {
        return certificadoMedicoRepository.findFirstByUsuarioIdUsuarioOrderByFechaVencimientoDesc(idSocio)
                .map(CertificadoMedico::getObservacionesPatologias)
                .orElse(null);
    }

    // Una patología del socio está en riesgo si menciona alguna contraindicación del ejercicio (sin tildes ni mayúsculas)
    // Ej.: "Condromalacia rotuliana en rodilla izquierda" CONTIENE "RODILLA" → la sentadilla queda marcada.
    // Por eso la IA agrega etiquetas como LUMBAR al guardar las patologías: alimenta esta comparación.
    // Es "static" (sin estado) para poder usarse con un certificado ya leído.
    private static List<String> riesgos(String patologias, String contraindicadas) {
        if (patologias == null || patologias.isBlank() || contraindicadas == null || contraindicadas.isBlank()) {
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
