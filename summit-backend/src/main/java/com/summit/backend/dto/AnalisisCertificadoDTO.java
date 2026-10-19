package com.summit.backend.dto;

// Lombok genera el código repetitivo en tiempo de compilación:
// @Data → getters, setters, equals, hashCode y toString; @Builder → construcción campo por campo
// (AnalisisCertificadoDTO.builder().apto(true)...build()); @NoArgsConstructor/@AllArgsConstructor → constructores.
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Lo que el asistente de IA leyó en un certificado médico. Es una propuesta: el personal la revisa
 * antes de guardarla en la ficha del socio.
 *
 * <p><b>Qué es un DTO:</b> "Data Transfer Object", un objeto que solo transporta datos entre el backend y el
 * frontend. Spring lo convierte automáticamente a JSON. Se usa en lugar de devolver entidades de la base
 * para controlar exactamente qué datos salen y con qué nombres.</p>
 *
 * <p>Lo arma AsistenteIaService.analizar(...) y lo muestra el componente ResultadoAnalisis del frontend.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalisisCertificadoDTO {
    private String pacienteNombre;         // a quién se le hizo el certificado (según lo que se lee)
    private String pacienteDni;            // solo números; null si no figura
    private String medicoNombre;           // quién firma el certificado (según lo que se lee); null si no figura
    private String medicoMatricula;        // matrícula tal como figura (ej. "M.N. 98.765"); null si no figura
    // Reglas exactas que calcula el backend: otro DNI, no apto, vencido, fecha ilegible/imposible/futura,
    // matrícula ausente o sin número. Revisar antes de guardar.
    private List<String> advertencias;
    // Indicios de certificado falso o no válido que detectó la IA (ej. "admite que no hubo examen"). Es una
    // opinión del modelo, no una regla exacta: por eso viaja separado de las advertencias.
    private List<String> senalesDeAlerta;
    private Boolean apto;                  // null si el certificado no lo dice (Boolean y no boolean: admite null)
    private LocalDate fechaEmision;        // null si no figura o no se pudo leer (viaja como "AAAA-MM-DD")
    private List<String> patologias;       // condiciones mencionadas, en pocas palabras
    private List<String> etiquetas;        // zonas del catálogo afectadas (HOMBRO, RODILLA...): alimentan la regla firme
    private List<String> restricciones;    // lo que el médico indica evitar o cuidar
    private String resumen;                // para el profesor
    private String observacionesSugeridas; // texto listo para el campo de patologías del certificado
    private String fuente;                 // TEXTO_PDF, PDF_ESCANEADO o IMAGEN (cómo se leyó el archivo)
    private String modelo;                 // qué modelo hizo la lectura (trazabilidad), ej. gemma4:12b
    private double segundos;               // cuánto tardó (se muestra al usuario)
}
