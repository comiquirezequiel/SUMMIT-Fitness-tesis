package com.summit.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Lo que el asistente de IA leyó en un certificado médico. Es una propuesta: el personal la revisa
 * antes de guardarla en la ficha del socio.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalisisCertificadoDTO {
    private String pacienteNombre;         // a quién se le hizo el certificado (según lo que se lee)
    private String pacienteDni;            // solo números; null si no figura
    private List<String> advertencias;     // otro DNI, no apto, vencido o fecha ilegible: revisar antes de guardar
    private Boolean apto;                  // null si el certificado no lo dice
    private LocalDate fechaEmision;        // null si no figura o no se pudo leer
    private List<String> patologias;       // condiciones mencionadas, en pocas palabras
    private List<String> etiquetas;        // zonas del catálogo afectadas (HOMBRO, RODILLA...): alimentan la regla firme
    private List<String> restricciones;    // lo que el médico indica evitar o cuidar
    private String resumen;                // para el profesor
    private String observacionesSugeridas; // texto listo para el campo de patologías del certificado
    private String fuente;                 // TEXTO_PDF, PDF_ESCANEADO o IMAGEN
    private String modelo;
    private double segundos;
}
