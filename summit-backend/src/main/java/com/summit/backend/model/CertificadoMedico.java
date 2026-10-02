package com.summit.backend.model;

import lombok.*;
import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "certificados_medicos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CertificadoMedico {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_certificado")
    private Long idCertificado;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "archivo_url", nullable = false, length = 255)
    private String archivoUrl;

    @Column(name = "fecha_emision", nullable = false)
    private LocalDate fechaEmision;

    @Column(name = "fecha_vencimiento", nullable = false)
    private LocalDate fechaVencimiento;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_legal", nullable = false, length = 20)
    private EstadoLegalCertificado estadoLegal;

    @Column(name = "observaciones_patologias", length = 500)
    private String observacionesPatologias;
}
