package com.summit.backend.service;

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
 * Controla cupos disponibles y permite reservar/cancelar.
 */
@Service
@RequiredArgsConstructor
public class ReservaService {

    private final ReservaClaseRepository reservaClaseRepository;
    private final ClaseHorarioRepository claseHorarioRepository;
    private final UsuarioRepository usuarioRepository;

    /**
     * Reserva una plaza en una clase grupal.
     * Verifica que no se exceda la capacidad máxima.
     */
    @Transactional
    public ReservaClase reservar(Long idUsuario, Long idHorario, LocalDate fechaClase) {
        Usuario socio = usuarioRepository.findById(idUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        ClaseHorario horario = claseHorarioRepository.findById(idHorario)
                .orElseThrow(() -> new RuntimeException("Horario no encontrado"));

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

    /**
     * Cancela una reserva existente (soft cancel).
     */
    public void cancelar(Long idReserva) {
        ReservaClase reserva = reservaClaseRepository.findById(idReserva)
                .orElseThrow(() -> new RuntimeException("Reserva no encontrada"));
        reserva.setEstado(EstadoReserva.CANCELADA);
        reservaClaseRepository.save(reserva);
    }

    public List<ReservaClase> listarPorSocio(Long idUsuario) {
        return reservaClaseRepository.findBySocioIdUsuario(idUsuario);
    }
}
