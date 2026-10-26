package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Turno de trabajo de una persona del equipo (FASES.md, Fase 9): de la entrada a la salida. Lo abre y lo cierra su
 * paso por el control de acceso de recepción, y lo corrige el admin dejando el motivo (CorreccionTurno).
 *
 * <p>Un turno que pasa la medianoche es uno solo y cuenta en el día en que empezó. Sin salida: si es el último de la
 * persona y empezó hace menos de AsistenciaPersonalService.HORAS_MAXIMAS_TURNO, está en curso; si no, se olvidó de
 * marcar la salida y queda incompleto hasta que el admin la carga.</p>
 */
@Entity
@Table(name = "turnos_personal", indexes = {
        @Index(name = "idx_turnos_personal_usuario", columnList = "usuario_id, entrada"),
        @Index(name = "idx_turnos_personal_entrada", columnList = "entrada")})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TurnoPersonal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_turno")
    private Long idTurno;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "entrada", nullable = false)
    private LocalDateTime entrada;

    // null mientras está en curso o si se olvidó de marcarla
    @Column(name = "salida")
    private LocalDateTime salida;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR) // texto, no ENUM de MySQL: agregar valores no rompe la base
    @Column(name = "origen", nullable = false, length = 20)
    private OrigenTurno origen;

    // Anulado por el admin: no suma horas, pero queda guardado con el motivo
    @Column(name = "anulado", nullable = false)
    private boolean anulado;

    // Los pasos por recepción (logs_asistencia) que lo abrieron y lo cerraron; null si las horas las cargó el admin.
    // Si recepción corrige en el momento "era una entrada" o "era la salida", ese registro cambia junto con el turno
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "log_entrada_id")
    private LogAsistencia logEntrada;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "log_salida_id")
    private LogAsistencia logSalida;
}
