package com.summit.backend.dto;

import java.time.LocalDateTime;

/**
 * Turno del personal que el admin carga o corrige. idUsuario solo hace falta al cargar uno nuevo; salida puede quedar
 * vacía solo en el turno de alguien que está trabajando ahora. El motivo queda registrado.
 */
public record TurnoRequest(Long idUsuario, LocalDateTime entrada, LocalDateTime salida, String motivo) {}
