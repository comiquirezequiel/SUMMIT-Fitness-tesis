package com.summit.backend.service;

import com.summit.backend.dto.EjercicioHistorialDTO;
import com.summit.backend.dto.LogEntrenamientoDTO;
import com.summit.backend.dto.LogEntrenamientoRequestDTO;
import com.summit.backend.dto.ProgresoEjercicioDTO;
import com.summit.backend.dto.SesionEntrenamientoDTO;
import com.summit.backend.model.GrupoMuscular;
import com.summit.backend.model.LogEntrenamiento;
import com.summit.backend.model.Rutina;
import com.summit.backend.model.RutinaEjercicio;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.LogEntrenamientoRepository;
import com.summit.backend.repository.RutinaEjercicioRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

/**
 * Servicio de entrenamientos: lo que el socio anota de su rutina (peso levantado y RPE)
 * y el historial que usa el profesor (sesiones y progreso por ejercicio).
 */
@Service
@RequiredArgsConstructor
public class EntrenamientoService {

    // Hasta cuántos días atrás se puede cargar un entrenamiento (y el socio, borrarlo)
    private static final int DIAS_PARA_CARGAR = 7;
    // Período del historial de sesiones si no se indican fechas
    private static final int DIAS_HISTORIAL = 90;

    private final LogEntrenamientoRepository logEntrenamientoRepository;
    private final RutinaEjercicioRepository rutinaEjercicioRepository;
    private final UsuarioRepository usuarioRepository;

    /** El registro guardado y si es nuevo (si no, se actualizó el que ya existía). */
    public record Resultado(LogEntrenamientoDTO registro, boolean nuevo) {}

    // Una sesión: lo registrado en una fecha para un día de una rutina
    private record ClaveSesion(LocalDate fecha, Long idRutina, Integer diaNumero) {}

    /**
     * Registra un ejercicio de la rutina activa. Hay un registro por ejercicio de la rutina y fecha:
     * si ya existe, se actualiza. Series y repeticiones, si no vienen, son las de la rutina.
     */
    @Transactional
    public Resultado registrar(LogEntrenamientoRequestDTO datos, String emailUsuario) {
        RutinaEjercicio item = buscarEjercicioDeRutina(datos.getIdRutinaEjercicio());
        Rutina rutina = item.getRutina();
        if (!Boolean.TRUE.equals(rutina.getActiva())) {
            throw new IllegalArgumentException("La rutina ya no está activa: no se pueden cargar entrenamientos");
        }
        LocalDate fecha = validarFecha(datos.getFecha());
        Integer rpe = datos.getRpe();
        if (rpe == null || rpe < 1 || rpe > 10) {
            throw new IllegalArgumentException("Indicá el RPE (esfuerzo percibido) de 1 a 10");
        }
        Double pesoKg = RutinaService.validarPeso(datos.getPesoKg());
        Integer series = datos.getSeries() != null
                ? RutinaService.validarSeries(datos.getSeries()) : item.getSeries();
        Integer repeticiones = datos.getRepeticiones() != null
                ? RutinaService.validarRepeticiones(datos.getRepeticiones()) : item.getRepeticiones();
        String comentario = RutinaService.textoOpcional(datos.getComentario(), 300,
                "El comentario no puede superar los 300 caracteres");
        Usuario cargadoPor = usuarioRepository.findByEmail(emailUsuario)
                .orElseThrow(() -> new IllegalStateException("Usuario no encontrado"));

        Optional<LogEntrenamiento> existente = logEntrenamientoRepository
                .findByRutinaEjercicioIdRutinaEjercicioAndFecha(item.getIdRutinaEjercicio(), fecha);
        LogEntrenamiento registro = existente.orElseGet(() -> LogEntrenamiento.builder()
                .socio(rutina.getSocio())
                .rutina(rutina)
                .rutinaEjercicio(item)
                .ejercicio(item.getEjercicio())
                .fecha(fecha)
                .build());
        registro.setDiaNumero(RutinaService.dia(item));
        registro.setPesoKg(pesoKg);
        registro.setSeries(series);
        registro.setRepeticiones(repeticiones);
        registro.setRpe(rpe);
        registro.setComentario(comentario);
        registro.setRegistradoPor(cargadoPor);
        registro.setFechaRegistro(LocalDateTime.now());
        return new Resultado(toDTO(logEntrenamientoRepository.save(registro)), existente.isEmpty());
    }

    /**
     * Borra un registro cargado por error. El socio solo corrige lo de los últimos días;
     * lo anterior es el historial que usa el profesor.
     */
    @Transactional
    public void eliminar(Long idLog, boolean loBorraElSocio) {
        LogEntrenamiento registro = buscarRegistro(idLog);
        if (loBorraElSocio && registro.getFecha().isBefore(LocalDate.now().minusDays(DIAS_PARA_CARGAR))) {
            throw new IllegalArgumentException("Solo podés borrar registros de los últimos " + DIAS_PARA_CARGAR + " días");
        }
        logEntrenamientoRepository.delete(registro);
    }

    /**
     * Sesiones entre dos fechas (por defecto, los últimos 90 días), de la más reciente a la más vieja.
     */
    @Transactional(readOnly = true)
    public List<SesionEntrenamientoDTO> sesiones(Long idSocio, LocalDate desde, LocalDate hasta) {
        LocalDate fin = hasta != null ? hasta : LocalDate.now();
        LocalDate inicio = desde != null ? desde : fin.minusDays(DIAS_HISTORIAL);
        if (inicio.isAfter(fin)) {
            throw new IllegalArgumentException("La fecha desde no puede ser posterior a la fecha hasta");
        }

        Map<ClaveSesion, List<LogEntrenamiento>> porSesion = new LinkedHashMap<>();
        for (LogEntrenamiento registro : logEntrenamientoRepository
                .findBySocioIdUsuarioAndFechaBetweenOrderByFechaDescFechaRegistroDesc(idSocio, inicio, fin)) {
            ClaveSesion clave = new ClaveSesion(registro.getFecha(), registro.getRutina().getIdRutina(), registro.getDiaNumero());
            porSesion.computeIfAbsent(clave, k -> new ArrayList<>()).add(registro);
        }
        return porSesion.values().stream().map(EntrenamientoService::resumirSesion).toList();
    }

    /**
     * Lo que el socio registró en una fecha (hoy si no se indica), en el orden de la rutina.
     */
    @Transactional(readOnly = true)
    public List<LogEntrenamientoDTO> registrosDelDia(Long idSocio, LocalDate fecha) {
        return logEntrenamientoRepository.findBySocioIdUsuarioAndFecha(idSocio, fecha != null ? fecha : LocalDate.now())
                .stream()
                .sorted(Comparator.comparing((LogEntrenamiento l) -> l.getRutina().getIdRutina())
                        .thenComparing(LogEntrenamiento::getDiaNumero)
                        .thenComparing(l -> l.getRutinaEjercicio() != null ? l.getRutinaEjercicio().getOrden() : null,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(LogEntrenamiento::getIdLog))
                .map(EntrenamientoService::toDTO)
                .toList();
    }

    /**
     * Ejercicios que el socio ya entrenó (para elegir cuál graficar), por nombre.
     */
    @Transactional(readOnly = true)
    public List<EjercicioHistorialDTO> ejerciciosConHistorial(Long idSocio) {
        return logEntrenamientoRepository.contarPorEjercicio(idSocio).stream()
                .map(fila -> EjercicioHistorialDTO.builder()
                        .idEjercicio((Long) fila[0])
                        .nombreEjercicio((String) fila[1])
                        .grupoMuscular(fila[2] != null ? ((GrupoMuscular) fila[2]).name() : null)
                        .registros((Long) fila[3])
                        .build())
                .toList();
    }

    /**
     * Progreso de un ejercicio, del registro más viejo al más nuevo (para el gráfico del profesor).
     */
    @Transactional(readOnly = true)
    public List<ProgresoEjercicioDTO> progreso(Long idSocio, Long idEjercicio) {
        if (idEjercicio == null) {
            throw new IllegalArgumentException("Indicá el ejercicio (idEjercicio)");
        }
        return logEntrenamientoRepository
                .findBySocioIdUsuarioAndEjercicioIdEjercicioOrderByFechaAscFechaRegistroAsc(idSocio, idEjercicio)
                .stream()
                .map(registro -> ProgresoEjercicioDTO.builder()
                        .fecha(registro.getFecha())
                        .pesoKg(registro.getPesoKg())
                        .repeticiones(registro.getRepeticiones())
                        .series(registro.getSeries())
                        .rpe(registro.getRpe())
                        .volumenKg(redondear(volumen(registro)))
                        .build())
                .toList();
    }

    /**
     * Socio dueño del ejercicio de la rutina (para controlar que un socio cargue solo lo suyo).
     */
    @Transactional(readOnly = true)
    public Long socioDelEjercicioDeRutina(Long idRutinaEjercicio) {
        return buscarEjercicioDeRutina(idRutinaEjercicio).getRutina().getSocio().getIdUsuario();
    }

    @Transactional(readOnly = true)
    public Long socioDelRegistro(Long idLog) {
        return buscarRegistro(idLog).getSocio().getIdUsuario();
    }

    /**
     * Indica si el usuario logueado (identificado por su email) es ese socio.
     */
    public boolean esElSocio(String email, Long idSocio) {
        return usuarioRepository.findByEmail(email)
                .map(u -> u.getIdUsuario().equals(idSocio))
                .orElse(false);
    }

    public static LogEntrenamientoDTO toDTO(LogEntrenamiento registro) {
        RutinaEjercicio item = registro.getRutinaEjercicio();
        return LogEntrenamientoDTO.builder()
                .idLog(registro.getIdLog())
                .idSocio(registro.getSocio().getIdUsuario())
                .idRutina(registro.getRutina().getIdRutina())
                .idRutinaEjercicio(item != null ? item.getIdRutinaEjercicio() : null)
                .idEjercicio(registro.getEjercicio().getIdEjercicio())
                .nombreEjercicio(registro.getEjercicio().getNombre())
                .fecha(registro.getFecha())
                .diaNumero(registro.getDiaNumero())
                .pesoKg(registro.getPesoKg())
                .repeticiones(registro.getRepeticiones())
                .series(registro.getSeries())
                .rpe(registro.getRpe())
                .comentario(registro.getComentario())
                .registradoPor(registro.getRegistradoPor().getNombreCompleto())
                .fechaRegistro(registro.getFechaRegistro())
                .build();
    }

    // ---- Métodos privados ----

    private RutinaEjercicio buscarEjercicioDeRutina(Long idRutinaEjercicio) {
        if (idRutinaEjercicio == null) {
            throw new IllegalArgumentException("Indicá el ejercicio de la rutina (idRutinaEjercicio)");
        }
        return rutinaEjercicioRepository.findById(idRutinaEjercicio)
                .orElseThrow(() -> new IllegalArgumentException(
                        "El ejercicio no está en la rutina (puede que el profesor lo haya quitado)"));
    }

    private LogEntrenamiento buscarRegistro(Long idLog) {
        return logEntrenamientoRepository.findById(idLog)
                .orElseThrow(() -> new NoSuchElementException("Registro de entrenamiento no encontrado"));
    }

    private static LocalDate validarFecha(LocalDate fecha) {
        LocalDate hoy = LocalDate.now();
        if (fecha == null) {
            return hoy;
        }
        if (fecha.isAfter(hoy)) {
            throw new IllegalArgumentException("La fecha del entrenamiento no puede ser futura");
        }
        if (fecha.isBefore(hoy.minusDays(DIAS_PARA_CARGAR))) {
            throw new IllegalArgumentException("Solo se pueden cargar entrenamientos de los últimos "
                    + DIAS_PARA_CARGAR + " días");
        }
        return fecha;
    }

    private static SesionEntrenamientoDTO resumirSesion(List<LogEntrenamiento> registros) {
        LogEntrenamiento primero = registros.get(0);
        return SesionEntrenamientoDTO.builder()
                .fecha(primero.getFecha())
                .idRutina(primero.getRutina().getIdRutina())
                .nombreRutina(primero.getRutina().getNombre())
                .diaNumero(primero.getDiaNumero())
                .ejerciciosRegistrados(registros.size())
                .rpePromedio(redondear(registros.stream().mapToInt(LogEntrenamiento::getRpe).average().orElse(0)))
                .tonelajeKg(redondear(registros.stream().mapToDouble(EntrenamientoService::volumen).sum()))
                .build();
    }

    // Peso × repeticiones × series (si falta alguno, el registro no suma volumen)
    private static double volumen(LogEntrenamiento registro) {
        if (registro.getPesoKg() == null || registro.getRepeticiones() == null || registro.getSeries() == null) {
            return 0;
        }
        return registro.getPesoKg() * registro.getRepeticiones() * registro.getSeries();
    }

    private static double redondear(double valor) {
        return Math.round(valor * 10) / 10.0;
    }
}
