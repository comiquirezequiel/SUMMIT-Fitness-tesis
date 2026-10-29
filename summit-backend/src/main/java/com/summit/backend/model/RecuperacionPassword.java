package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Pedido de "¿Olvidaste tu contraseña?": el link que llega por email sirve una sola vez y por poco tiempo.
 * Se guarda solo la huella SHA-256 del token: quien lea la base no puede usar los links.
 */
@Entity
@Table(name = "recuperaciones_password")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecuperacionPassword {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_recuperacion")
    private Long idRecuperacion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "hash_token", nullable = false, unique = true, length = 64)
    private String hashToken;

    @Column(name = "creada", nullable = false)
    private LocalDateTime creada;

    @Column(name = "vence", nullable = false)
    private LocalDateTime vence;

    // Cuándo se usó o se anuló (por un pedido nuevo); null mientras sirve
    @Column(name = "usada")
    private LocalDateTime usada;
}
