package com.summit.backend.dto;

// Lombok genera el código repetitivo en tiempo de compilación:
// @Data → getters, setters, equals, hashCode y toString; @Builder → construcción campo por campo
// (AnalisisCertificadoDTO.builder().apto(true)...build()); @NoArgsConstructor/@AllArgsConstructor → constructores.
import lombok.Builder;

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
@Builder
public record AnalisisCertificadoDTO(
        String pacienteNombre, // a quién se le hizo el certificado (según lo que se lee)
        String pacienteDni, // solo números; null si no figura
        String medicoNombre, // quién firma el certificado (según lo que se lee); null si no figura
        String medicoMatricula, // matrícula tal como figura (ej. "M.N. 98.765"); null si no figura
        // Reglas exactas que calcula el backend: otro DNI, no apto, vencido, fecha ilegible/imposible/futura,
        // matrícula ausente o sin número. Revisar antes de guardar.
        List<String> advertencias,
        // Indicios de certificado falso o no válido que detectó la IA (ej. "admite que no hubo examen"). Es una
        // opinión del modelo, no una regla exacta: por eso viaja separado de las advertencias.
        List<String> senalesDeAlerta,
        Boolean apto, // null si el certificado no lo dice (Boolean y no boolean: admite null)
        LocalDate fechaEmision, // null si no figura o no se pudo leer (viaja como "AAAA-MM-DD")
        List<String> patologias, // condiciones mencionadas, en pocas palabras
        List<String> etiquetas, // zonas del catálogo afectadas (HOMBRO, RODILLA...): alimentan la regla firme
        List<String> restricciones, // lo que el médico indica evitar o cuidar
        String resumen, // para el profesor
        String observacionesSugeridas, // texto listo para el campo de patologías del certificado
        String fuente, // TEXTO_PDF, PDF_ESCANEADO o IMAGEN (cómo se leyó el archivo)
        String modelo, // qué modelo hizo la lectura (trazabilidad), ej. gemma4:12b
        double segundos) { // cuánto tardó (se muestra al usuario)
}
