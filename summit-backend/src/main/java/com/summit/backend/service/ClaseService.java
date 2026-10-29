package com.summit.backend.service;

import com.summit.backend.dto.AgendaClaseDTO;
import com.summit.backend.model.Clase;
import com.summit.backend.model.ClaseHorario;
import com.summit.backend.model.DiaSemana;
import com.summit.backend.model.EstadoReserva;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.ClaseHorarioRepository;
import com.summit.backend.repository.ClaseRepository;
import com.summit.backend.repository.ReservaClaseRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Servicio de clases grupales.
 * Gestiona clases, horarios (sin superposiciones) y la agenda diaria con cupos.
 */
@Service
@RequiredArgsConstructor
public class ClaseService {

    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");

    private final ClaseRepository claseRepository;
    private final ClaseHorarioRepository claseHorarioRepository;
    private final ReservaClaseRepository reservaClaseRepository;
    private final UsuarioRepository usuarioRepository;

    public List<Clase> listar() {
        return claseRepository.findAll();
    }

    public Clase buscarPorId(Long id) {
        return claseRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Clase no encontrada con ID: " + id));
    }

    public Clase crear(Clase clase) {
        if (clase.getNombre() == null || clase.getNombre().isBlank()) {
            throw new IllegalArgumentException("El nombre de la clase es obligatorio");
        }
        if (clase.getCapacidadMaxima() == null || clase.getCapacidadMaxima() < 1) {
            throw new IllegalArgumentException("La capacidad debe ser de al menos 1 persona");
        }
        clase.setNombre(clase.getNombre().trim());
        clase.setProfesor(resolverProfesor(clase.getProfesor()));
        return claseRepository.save(clase);
    }

    public Clase actualizar(Long id, Clase data) {
        Clase clase = buscarPorId(id);
        if (data.getNombre() != null) clase.setNombre(data.getNombre());
        if (data.getDescripcion() != null) clase.setDescripcion(data.getDescripcion());
        if (data.getCapacidadMaxima() != null) clase.setCapacidadMaxima(data.getCapacidadMaxima());
        return claseRepository.save(clase);
    }

    /**
     * Agrega un horario semanal a una clase, validando que no choque con otro horario
     * de la misma clase ni con otra clase del mismo profesor.
     */
    @Transactional
    public ClaseHorario agregarHorario(Long idClase, ClaseHorario horario) {
        Clase clase = buscarPorId(idClase);
        if (horario.getDiaSemana() == null || horario.getHoraInicio() == null || horario.getHoraFin() == null) {
            throw new IllegalArgumentException("Indicá el día y la hora de inicio y fin");
        }
        if (!horario.getHoraFin().isAfter(horario.getHoraInicio())) {
            throw new IllegalArgumentException("La hora de fin debe ser posterior a la de inicio");
        }
        verificarSuperposicion(clase, horario);
        horario.setClase(clase);
        return claseHorarioRepository.save(horario);
    }

    public List<ClaseHorario> listarHorarios(Long idClase) {
        return claseHorarioRepository.findByClaseIdClase(idClase);
    }

    public void desactivar(Long id) {
        Clase clase = buscarPorId(id);
        clase.setActiva(false);
        claseRepository.save(clase);
    }

    /**
     * Clases del día de la semana de esa fecha, con las reservas confirmadas para esa fecha.
     */
    @Transactional(readOnly = true)
    public List<AgendaClaseDTO> agenda(LocalDate fecha) {
        DiaSemana dia = diaSemana(fecha);
        return claseHorarioRepository.findByDiaSemanaAndClaseActivaTrueOrderByHoraInicio(dia).stream()
                .map(h -> agendaDTO(h, reservaClaseRepository.countByHorarioIdHorarioAndFechaClaseAndEstadoNot(
                        h.getIdHorario(), fecha, EstadoReserva.CANCELADA)))
                .toList();
    }

    public static DiaSemana diaSemana(LocalDate fecha) {
        return DiaSemana.values()[fecha.getDayOfWeek().getValue() - 1];
    }

    private static AgendaClaseDTO agendaDTO(ClaseHorario h, long reservados) {
        Clase clase = h.getClase();
        Usuario profesor = clase.getProfesor();
        return AgendaClaseDTO.builder()
                .idHorario(h.getIdHorario())
                .idClase(clase.getIdClase())
                .nombreClase(clase.getNombre())
                .descripcion(clase.getDescripcion())
                .idProfesor(profesor != null ? profesor.getIdUsuario() : null)
                .profesor(profesor != null ? profesor.getNombreCompleto() : null)
                .diaSemana(h.getDiaSemana().name())
                .horaInicio(h.getHoraInicio())
                .horaFin(h.getHoraFin())
                .capacidad(clase.getCapacidadMaxima())
                .reservados(reservados)
                .build();
    }

    // Requisito 3.5: la agenda evita colisiones de horarios
    private void verificarSuperposicion(Clase clase, ClaseHorario nuevo) {
        Long idProfesor = clase.getProfesor() != null ? clase.getProfesor().getIdUsuario() : null;
        for (ClaseHorario existente : claseHorarioRepository.findByDiaSemanaAndClaseActivaTrueOrderByHoraInicio(nuevo.getDiaSemana())) {
            boolean seSuperponen = nuevo.getHoraInicio().isBefore(existente.getHoraFin())
                    && nuevo.getHoraFin().isAfter(existente.getHoraInicio());
            if (!seSuperponen) {
                continue;
            }
            Clase otra = existente.getClase();
            String rango = existente.getHoraInicio().format(HORA) + " a " + existente.getHoraFin().format(HORA);
            String dia = nuevo.getDiaSemana().name().toLowerCase();
            if (otra.getIdClase().equals(clase.getIdClase())) {
                throw new IllegalArgumentException("La clase ya tiene un horario el " + dia + " de " + rango);
            }
            if (idProfesor != null && otra.getProfesor() != null && idProfesor.equals(otra.getProfesor().getIdUsuario())) {
                throw new IllegalArgumentException("El profesor " + otra.getProfesor().getNombreCompleto()
                        + " ya da " + otra.getNombre() + " el " + dia + " de " + rango);
            }
        }
    }

    private Usuario resolverProfesor(Usuario profesor) {
        if (profesor == null || profesor.getIdUsuario() == null) {
            return null;
        }
        return usuarioRepository.findById(profesor.getIdUsuario())
                .filter(u -> u.getRol() == Rol.PROFESOR)
                .orElseThrow(() -> new IllegalArgumentException("El profesor indicado no existe"));
    }
}
