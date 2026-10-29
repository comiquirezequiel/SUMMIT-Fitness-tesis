package com.summit.backend.service;

import com.summit.backend.dto.ReservaDTO;
import com.summit.backend.model.*;
import com.summit.backend.repository.ClaseHorarioRepository;
import com.summit.backend.repository.ReservaClaseRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Servicio de reservas de clases grupales.
 * Controla cupos disponibles, permite reservar/cancelar y registrar asistencia.
 */
@Service
@RequiredArgsConstructor
public class ReservaService {

    private final ReservaClaseRepository reservaClaseRepository;
    private final ClaseHorarioRepository claseHorarioRepository;
    private final UsuarioRepository usuarioRepository;
    private final CertificadoMedicoService certificadoMedicoService;

    /**
     * Reserva una plaza en una clase grupal.
     * Verifica fecha, cupo, que no esté reservada dos veces y el apto médico (Ley 5397).
     */
    @Transactional
    public ReservaClase reservar(Long idUsuario, Long idHorario, LocalDate fechaClase) {
        Usuario socio = usuarioRepository.findById(idUsuario)
                .filter(u -> u.getRol() == Rol.SOCIO)
                .orElseThrow(() -> new RuntimeException("Socio no encontrado"));
        if (socio.getEstado() != EstadoUsuario.ACTIVO) {
            throw new RuntimeException("El socio no está activo");
        }

        ClaseHorario horario = claseHorarioRepository.findById(idHorario)
                .orElseThrow(() -> new RuntimeException("Horario no encontrado"));
        if (!Boolean.TRUE.equals(horario.getClase().getActiva())) {
            throw new RuntimeException("La clase no está activa");
        }
        if (fechaClase.isBefore(LocalDate.now())) {
            throw new RuntimeException("No se puede reservar una clase de una fecha pasada");
        }
        if (ClaseService.diaSemana(fechaClase) != horario.getDiaSemana()) {
            throw new RuntimeException("La clase es los " + horario.getDiaSemana().name().toLowerCase()
                    + " y la fecha elegida no coincide");
        }
        if (reservaClaseRepository.existsBySocioIdUsuarioAndHorarioIdHorarioAndFechaClaseAndEstadoNot(
                idUsuario, idHorario, fechaClase, EstadoReserva.CANCELADA)) {
            throw new RuntimeException("El socio ya tiene una reserva para esta clase");
        }
        if (!certificadoMedicoService.isAptoMedicoVigente(idUsuario)) {
            throw new RuntimeException("El socio no tiene el apto médico vigente (Ley 5397)");
        }

        // Verificar cupo disponible (excluir canceladas)
        long reservasActuales = reservaClaseRepository
                .countByHorarioIdHorarioAndFechaClaseAndEstadoNot(idHorario, fechaClase, EstadoReserva.CANCELADA);

        if (reservasActuales >= horario.getClase().getCapacidadMaxima()) {
            throw new RuntimeException("La clase está completa. No hay cupos disponibles.");
        }

        ReservaClase reserva = ReservaClase.builder()
                .socio(socio)
                .horario(horario)
                .fechaClase(fechaClase)
                .estado(EstadoReserva.CONFIRMADA)
                .build();

        return reservaClaseRepository.save(reserva);
    }

    public ReservaClase buscar(Long idReserva) {
        return reservaClaseRepository.findById(idReserva)
                .orElseThrow(() -> new RuntimeException("Reserva no encontrada"));
    }

    /**
     * Cancela una reserva confirmada (soft cancel). Las ya marcadas como presente o ausente no se
     * cancelan, así una cancelación no borra el registro de inasistencias.
     */
    public void cancelar(Long idReserva) {
        ReservaClase reserva = buscar(idReserva);
        if (reserva.getEstado() != EstadoReserva.CONFIRMADA) {
            throw new IllegalArgumentException("Solo se pueden cancelar reservas confirmadas");
        }
        reserva.setEstado(EstadoReserva.CANCELADA);
        reservaClaseRepository.save(reserva);
    }

    /**
     * El profesor o recepción marcan si el socio asistió a la clase (registro de inasistencias).
     */
    @Transactional
    public ReservaDTO registrarAsistencia(Long idReserva, EstadoReserva estado) {
        if (estado != EstadoReserva.ASISTIO && estado != EstadoReserva.AUSENTE) {
            throw new IllegalArgumentException("El estado debe ser ASISTIO o AUSENTE");
        }
        ReservaClase reserva = buscar(idReserva);
        if (reserva.getEstado() == EstadoReserva.CANCELADA) {
            throw new IllegalArgumentException("La reserva está cancelada");
        }
        if (reserva.getFechaClase().isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("La clase todavía no se dictó");
        }
        reserva.setEstado(estado);
        return toDTO(reservaClaseRepository.save(reserva));
    }

    @Transactional(readOnly = true)
    public List<ReservaDTO> listarPorSocio(Long idUsuario) {
        return reservaClaseRepository.findBySocioIdUsuario(idUsuario)
                .stream().map(ReservaService::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public List<ReservaDTO> listarPorHorario(Long idHorario, LocalDate fecha) {
        return reservaClaseRepository.findByHorarioIdHorarioAndFechaClaseOrderByFechaReserva(idHorario, fecha)
                .stream().map(ReservaService::toDTO).toList();
    }

    public static ReservaDTO toDTO(ReservaClase r) {
        return ReservaDTO.builder()
                .idReserva(r.getIdReserva())
                .idHorario(r.getHorario().getIdHorario())
                .idSocio(r.getSocio().getIdUsuario())
                .nombreSocio(r.getSocio().getNombreCompleto())
                .dni(r.getSocio().getDni())
                .fechaClase(r.getFechaClase())
                .fechaReserva(r.getFechaReserva())
                .estado(r.getEstado().name())
                .build();
    }
}
