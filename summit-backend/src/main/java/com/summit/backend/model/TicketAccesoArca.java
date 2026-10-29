package com.summit.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Permiso de acceso de ARCA (Ticket de Acceso del WSAA): vale 12 horas y hay que usarlo hasta que venza, porque ARCA
 * no da otro mientras haya uno vigente. Se guarda para no perderlo al reiniciar el backend. Es un secreto: el token y
 * la firma no se muestran ni se escriben en los logs.
 */
@Entity
@Table(name = "tickets_acceso_arca",
        uniqueConstraints = @UniqueConstraint(name = "uk_ticket_arca", columnNames = {"ambiente", "huella_certificado"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketAccesoArca {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ticket")
    private Long idTicket;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "ambiente", nullable = false, length = 15)
    private AmbienteArca ambiente;

    // El permiso es del certificado con el que se pidió (SHA-256 del certificado, en hexadecimal)
    @Column(name = "huella_certificado", nullable = false, length = 64)
    private String huellaCertificado;

    @Column(name = "token", nullable = false, columnDefinition = "TEXT")
    private String token;

    @Column(name = "firma", nullable = false, columnDefinition = "TEXT")
    private String firma;

    // Hora argentina
    @Column(name = "vence", nullable = false)
    private LocalDateTime vence;
}
