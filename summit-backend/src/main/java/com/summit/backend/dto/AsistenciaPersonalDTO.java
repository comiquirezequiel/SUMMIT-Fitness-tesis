package com.summit.backend.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Asistencia del personal en un período (pantalla del admin): horas por persona y por día, quién está trabajando ahora
 * y los turnos que quedaron sin salida. Los turnos cuentan en el día en que empezaron.
 *
 * @param equipo          todo el personal (también el inactivo), para el filtro por persona
 * @param personas        resumen y detalle de cada persona en el período (el personal activo aparece aunque no haya
 *                        trabajado; el inactivo, solo si tiene turnos)
 * @param trabajandoAhora turnos en curso en este momento, sea cual sea el período
 * @param sinSalida       turnos que quedaron sin salida en los últimos días, sea cual sea el período, para corregirlos
 */
public record AsistenciaPersonalDTO(LocalDate desde, LocalDate hasta, List<Miembro> equipo, List<Persona> personas,
                                    Totales totales, List<Turno> trabajandoAhora, List<Turno> sinSalida) {

    public record Miembro(Long idUsuario, String nombre, String rol, boolean activo) {}

    /**
     * @param minutos         horas trabajadas en el período, en minutos (solo turnos completos)
     * @param diasTrabajados  días con algún turno (también los incompletos)
     * @param diasIncompletos días con algún turno sin salida
     */
    public record Persona(Long idUsuario, String nombre, String dni, String rol, boolean activo, boolean trabajandoAhora,
                          int diasTrabajados, long minutos, int diasIncompletos, List<Dia> dias) {}

    /**
     * @param minutos    suma de los turnos completos del día (los anulados no cuentan)
     * @param incompleto algún turno del día quedó sin salida
     * @param enCurso    algún turno del día sigue en curso
     * @param turnos     todos los turnos del día, también los anulados (que la pantalla muestra tachados)
     */
    public record Dia(LocalDate fecha, long minutos, boolean incompleto, boolean enCurso, List<Turno> turnos) {}

    /**
     * @param estado  COMPLETO, EN_CURSO o SIN_SALIDA
     * @param minutos duración (en uno en curso, hasta ahora; null si quedó sin salida)
     * @param origen  RECEPCION o MANUAL
     */
    public record Turno(Long idTurno, Long idUsuario, String nombre, String rol, LocalDateTime entrada, LocalDateTime salida,
                        Long minutos, String estado, boolean anulado, String origen, List<Correccion> correcciones) {}

    /**
     * @param accion ALTA, CAMBIO o ANULACION
     */
    public record Correccion(LocalDateTime fecha, String autor, String accion, String motivo,
                             LocalDateTime entradaAnterior, LocalDateTime salidaAnterior,
                             LocalDateTime entradaNueva, LocalDateTime salidaNueva) {}

    /**
     * @param diasTrabajados suma de los días trabajados de cada persona
     */
    public record Totales(long minutos, int diasTrabajados, int personasQueTrabajaron, int turnosSinSalida) {}
}
