package com.summit.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.summit.backend.dto.AnalisisCertificadoDTO;
import com.summit.backend.dto.SugerenciaEjerciciosDTO;
import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.model.Ejercicio;
import com.summit.backend.model.Rol;
import com.summit.backend.repository.CertificadoMedicoRepository;
import com.summit.backend.repository.EjercicioRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
// Apache PDFBox 3.0.3 (agregada en pom.xml): librería estándar de Java para trabajar con PDF.
// Loader abre el PDF, PDFTextStripper extrae su texto y PDFRenderer dibuja una página como imagen.
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

// ImageIO, Graphics2D y BufferedImage vienen con Java: sirven para leer, achicar y guardar imágenes
// sin agregar librerías.
import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.TreeSet;

/**
 * Asistente de IA para la ficha médica (modelo local con Ollama):
 * 1) lee un certificado médico (PDF con texto, PDF escaneado o foto) y propone apto, fecha, patologías,
 *    restricciones y un resumen para el profesor;
 * 2) sugiere qué ejercicios del catálogo conviene evitar según las patologías del socio.
 * Solo propone: el personal confirma antes de guardar, y la regla firme del constructor (patologías contra
 * contraindicaciones del catálogo) sigue decidiendo las alertas.
 *
 * <p><b>Rol en la arquitectura:</b> es la capa de "lógica de negocio" de la IA. No sabe CÓMO se habla con
 * Ollama (eso lo hace {@link OllamaClient}); sabe QUÉ pedirle, cómo preparar el certificado y qué hacer con
 * la respuesta. Sigue el patrón de capas del resto del backend: Controller → Service → (Repository / cliente externo).</p>
 *
 * <p><b>Principio de diseño:</b> el servicio NO confía ciegamente en la IA. Todo lo que devuelve el modelo
 * se valida (largos, fechas imposibles, valores fuera de las listas) y los controles críticos
 * (DNI de otra persona, vencimiento) los calcula este código, no el modelo.</p>
 *
 * <p>Ningún método de esta clase guarda datos: solo leen y devuelven propuestas. Guardar es responsabilidad
 * de CertificadoMedicoService, y solo ocurre cuando una persona confirma en la pantalla.</p>
 */
@Service
// @RequiredArgsConstructor (Lombok) genera el constructor con todos los campos "final":
// Spring lo usa para inyectar las dependencias (inyección por constructor, la forma recomendada).
@RequiredArgsConstructor
public class AsistenteIaService {

    // Menos texto que esto en un PDF = está escaneado (es una imagen): se manda la página como imagen
    // (un PDF escaneado es una foto metida dentro de un PDF: PDFBox no encuentra texto o encuentra muy poco).
    private static final int MIN_TEXTO_PDF = 40;
    // Lado máximo de las fotos que se envían al modelo. Una foto de celular mide ~4000 px: achicarla a 1600 px
    // reduce el tamaño a enviar y el tiempo de procesamiento sin perder legibilidad (el modelo internamente
    // trabaja con imágenes aún más chicas).
    private static final int MAX_LADO_IMAGEN = 1600;
    // Un certificado médico rara vez tiene más de 1 o 2 páginas; limitarlo evita prompts enormes.
    private static final int MAX_PAGINAS_ESCANEADAS = 2;
    // El modelo tiene una "ventana de contexto" (cuánto texto puede leer de una vez, 4096 tokens por defecto
    // en este equipo). Con más de ~150 ejercicios en la lista, el prompt podría no entrar completo.
    private static final int MAX_EJERCICIOS_EN_PROMPT = 150;

    // Dependencias (las inyecta Spring):
    private final OllamaClient ollama;                                  // habla con la IA
    private final ArchivoService archivoService;                        // lee el archivo del certificado del disco
    private final CertificadoMedicoService certificadoMedicoService;    // busca el certificado y valida que sea del socio
    private final CertificadoMedicoRepository certificadoMedicoRepository; // certificado actual del socio (MySQL)
    private final EjercicioRepository ejercicioRepository;              // catálogo de ejercicios (MySQL)
    private final UsuarioRepository usuarioRepository;                  // verifica que el socio exista
    private final RutinaService rutinaService;                          // la regla firme de contraindicaciones

    // Delegación directa: el controlador expone /api/ia/estado y la página decide si habilita los botones.
    public OllamaClient.Estado estado() {
        return ollama.estado();
    }

    /**
     * Analiza un certificado antes de subirlo (no guarda nada).
     *
     * <p>Se usa en el alta de socio y en "Cargar nuevo certificado" de la ficha: la lectura precarga el
     * formulario (fecha, patologías, resumen) y el archivo se guarda recién cuando el usuario confirma.</p>
     *
     * @param dniEsperado DNI del socio (si se conoce) para avisar si el certificado es de otra persona
     */
    public AnalisisCertificadoDTO analizarArchivo(MultipartFile archivo, String dniEsperado) {
        // MultipartFile = el archivo tal como llegó en el formulario (multipart/form-data) desde el navegador.
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("Adjuntá el certificado (PDF o imagen)");
        }
        try {
            // getBytes(): el contenido completo del archivo en memoria (máximo 5 MB, lo limita Spring en la configuración).
            return analizar(archivo.getBytes(), dniEsperado);
        } catch (IOException e) {
            throw new IllegalArgumentException("No se pudo leer el archivo");
        }
    }

    /**
     * Analiza un certificado ya cargado en la ficha del socio (no guarda nada).
     *
     * <p>@Transactional(readOnly = true): abre una transacción de solo lectura. Es necesaria porque
     * certificado.getUsuario() es una relación "LAZY" de JPA (el socio se carga de la base recién cuando se lo pide)
     * y eso solo funciona dentro de una transacción abierta. "readOnly" le avisa a Hibernate que no habrá escrituras.</p>
     */
    @Transactional(readOnly = true)
    public AnalisisCertificadoDTO analizarGuardado(Long idSocio, Long idCertificado) {
        // buscarDelSocio (método que ya existía) valida que ese certificado pertenezca a ese socio:
        // evita que alguien analice un certificado ajeno cambiando el número en la URL.
        CertificadoMedico certificado = certificadoMedicoService.buscarDelSocio(idSocio, idCertificado);
        // Se lee el archivo guardado en disco (uploads/certificados/...) y se compara contra el DNI real del socio.
        return analizar(archivoService.leer(certificado.getArchivoUrl()), certificado.getUsuario().getDni());
    }

    /**
     * El corazón del asistente: prepara el certificado, se lo envía al modelo y valida lo que responde.
     * Es privado: lo usan los dos métodos públicos de arriba (archivo nuevo o archivo ya guardado).
     */
    private AnalisisCertificadoDTO analizar(byte[] contenido, String dniEsperado) {
        // PASO 1. Tipo REAL del archivo según sus primeros bytes (la "firma"): %PDF, JPG, PNG o WEBP.
        // No se confía en la extensión del nombre (.pdf/.jpg) porque se puede falsificar.
        String tipo = ArchivoService.tipoDe(Arrays.copyOf(contenido, Math.min(12, contenido.length)));
        if (tipo == null) {
            throw new IllegalArgumentException("Formato no permitido: subí un PDF, JPG, PNG o WEBP");
        }
        // System.nanoTime() mide tiempo transcurrido con precisión: se usa para informar cuánto tardó el análisis.
        long inicio = System.nanoTime();
        // PASO 2. Las etiquetas (zonas del cuerpo) que usa el catálogo: el modelo solo podrá elegir de esta lista.
        List<String> etiquetas = etiquetasDelCatalogo();

        // PASO 3. Preparar el certificado según su tipo. Se llena "texto" (si se pudo extraer) o "imagenes".
        String texto = null;
        List<String> imagenes = new ArrayList<>();
        String fuente;   // de dónde salió la lectura: se le muestra al usuario
        if ("application/pdf".equals(tipo)) {
            // try-with-resources: el PDF se cierra solo al terminar el bloque (libera memoria aunque haya error).
            try (PDDocument pdf = Loader.loadPDF(contenido)) {
                PDFTextStripper extractor = new PDFTextStripper();
                extractor.setEndPage(3);                       // solo las primeras 3 páginas
                String extraido = extractor.getText(pdf).strip();
                // Se cuentan los caracteres sin espacios: si hay suficiente texto, el PDF es "digital".
                if (extraido.replaceAll("\\s+", "").length() >= MIN_TEXTO_PDF) {
                    // Texto: es lo más rápido y preciso para el modelo. Se corta en 6000 caracteres para no
                    // superar la ventana de contexto.
                    texto = extraido.length() > 6000 ? extraido.substring(0, 6000) : extraido;
                    fuente = "TEXTO_PDF";
                } else {
                    // PDF escaneado: no tiene texto, es una imagen. Se "dibuja" cada página a 150 dpi
                    // (resolución suficiente para leer, sin generar imágenes enormes) y se envía como imagen.
                    PDFRenderer renderizador = new PDFRenderer(pdf);
                    for (int i = 0; i < Math.min(MAX_PAGINAS_ESCANEADAS, pdf.getNumberOfPages()); i++) {
                        imagenes.add(base64(renderizador.renderImageWithDPI(i, 150)));
                    }
                    fuente = "PDF_ESCANEADO";
                }
            } catch (IOException e) {
                throw new IllegalArgumentException("No se pudo leer el PDF: puede estar dañado o protegido con contraseña");
            }
        } else {
            // Foto (JPG/PNG/WEBP): se achica si es muy grande y se envía como imagen.
            imagenes.add(imagenParaModelo(contenido));
            fuente = "IMAGEN";
        }

        // PASO 4. Consulta a la IA: instrucciones + (texto dentro del prompt o imágenes) + esquema obligatorio.
        // "r" es el JSON que devolvió el modelo, por ejemplo {"apto": true, "fechaEmision": "2026-08-03", ...}.
        JsonNode r = ollama.generarJson(promptCertificado(texto, etiquetas), imagenes, esquemaCertificado(etiquetas));

        // PASO 5. Validación de la respuesta: nunca se usa "tal cual".
        // r.path("campo") devuelve un nodo vacío (y no null) si el campo faltara: evita NullPointerException.
        List<String> patologias = lista(r.path("patologias"), 10, 80);            // máx. 10 patologías de 80 caracteres
        Boolean apto = r.path("apto").isBoolean() ? r.path("apto").asBoolean() : null; // solo true/false reales; si no, "no lo indica"
        LocalDate fechaEmision = fecha(r.path("fechaEmision").asText(null));        // descarta fechas ilegibles o futuras
        String pacienteNombre = recortar(r.path("pacienteNombre").asText(""), 100);
        // "\\D" = cualquier caracter que NO sea dígito: "28.456.789" queda "28456789" para comparar con el DNI del socio.
        String pacienteDni = r.path("pacienteDni").asText("").replaceAll("\\D", "");
        // Las etiquetas se normalizan (mayúsculas, sin tildes) y se filtran contra el catálogo: doble seguridad
        // además del "enum" del esquema. distinct() elimina repetidas.
        List<String> etiquetasDetectadas = lista(r.path("etiquetas"), 10, 30).stream()
                .map(AsistenteIaService::normalizar).filter(etiquetas::contains).distinct().toList();
        // PASO 6. Armado de la respuesta para la página (patrón Builder de Lombok: se completa campo por campo).
        return AnalisisCertificadoDTO.builder()
                .pacienteNombre(pacienteNombre.isEmpty() ? null : pacienteNombre)
                .pacienteDni(pacienteDni.isEmpty() ? null : pacienteDni)
                // Advertencias calculadas por ESTE código (no por la IA): DNI distinto, no apto, vencido, sin fecha.
                .advertencias(advertencias(dniEsperado, pacienteNombre, pacienteDni, apto, fechaEmision))
                .apto(apto)
                .fechaEmision(fechaEmision)
                .patologias(patologias)
                .etiquetas(etiquetasDetectadas)
                .restricciones(lista(r.path("restricciones"), 10, 150))
                .resumen(recortar(r.path("resumen").asText(""), 1000))      // 1000 = largo de la columna resumen_ia
                // Texto listo para el campo "patologías" del certificado (patologías + etiquetas faltantes).
                .observacionesSugeridas(observaciones(patologias, etiquetasDetectadas))
                .fuente(fuente)
                .modelo(ollama.getModelo())
                .segundos(segundosDesde(inicio))
                .build();
    }

    /**
     * Ejercicios del catálogo que el socio debería evitar: los de la regla firme y los que sugiere la IA,
     * a partir de las patologías y el resumen guardados en su certificado.
     *
     * <p>No se guarda el resultado: se calcula cada vez que el profesor lo pide, así refleja siempre
     * la ficha médica y el catálogo actuales.</p>
     */
    @Transactional(readOnly = true)
    public SugerenciaEjerciciosDTO ejerciciosAEvitar(Long idSocio) {
        // 1) El socio debe existir y tener rol SOCIO (NoSuchElementException → el controlador responde 404).
        usuarioRepository.findById(idSocio)
                .filter(u -> u.getRol() == Rol.SOCIO)
                .orElseThrow(() -> new NoSuchElementException("Socio no encontrado"));
        // 2) Certificado "actual" = el de vencimiento más lejano (el mismo criterio que usa todo el sistema).
        CertificadoMedico certificado = certificadoMedicoRepository
                .findFirstByUsuarioIdUsuarioOrderByFechaVencimientoDesc(idSocio).orElse(null);
        String patologias = certificado != null ? certificado.getObservacionesPatologias() : null;
        String resumen = certificado != null ? certificado.getResumenIa() : null;
        // Sin patologías ni resumen no hay nada que analizar: se evita gastar 30 s de GPU en una consulta vacía.
        if (vacio(patologias) && vacio(resumen)) {
            throw new IllegalArgumentException("El socio no tiene patologías cargadas en su certificado: no hay ejercicios para evitar");
        }
        // 3) Catálogo completo ordenado por nombre (para que el prompt sea estable y legible).
        List<Ejercicio> catalogo = ejercicioRepository.findAll(Sort.by("nombre"));
        if (catalogo.isEmpty()) {
            throw new IllegalArgumentException("El catálogo de ejercicios está vacío");
        }
        // Se limita la cantidad que entra al prompt (ventana de contexto). subList no copia: es una "vista".
        List<Ejercicio> enPrompt = catalogo.subList(0, Math.min(MAX_EJERCICIOS_EN_PROMPT, catalogo.size()));
        // 4) La regla firme (determinística): idEjercicio → patologías del socio que chocan con ese ejercicio.
        Map<Long, List<String>> porRegla = rutinaService.contraindicadosPorRegla(idSocio);

        // 5) Consulta a la IA (solo texto, sin imágenes). El esquema recibe la lista de ids válidos.
        long inicio = System.nanoTime();
        JsonNode r = ollama.generarJson(promptEjercicios(patologias, resumen, enPrompt), List.of(),
                esquemaEjercicios(enPrompt.stream().map(Ejercicio::getIdEjercicio).toList()));

        // Solo ids que existen en el catálogo (el modelo no puede agregar ejercicios inventados)
        // LinkedHashMap conserva el orden en que los devolvió el modelo; putIfAbsent ignora repetidos.
        Map<Long, String> motivosIa = new LinkedHashMap<>();
        for (JsonNode item : r.path("ejercicios")) {
            long id = item.path("idEjercicio").asLong(-1);   // -1 si faltara: nunca coincide con un id real
            if (enPrompt.stream().anyMatch(e -> e.getIdEjercicio() == id)) {
                motivosIa.putIfAbsent(id, recortar(item.path("motivo").asText(""), 250));
            }
        }

        // 6) Combinación de las dos fuentes, recorriendo el catálogo: cada ejercicio marcado por la regla,
        //    por la IA o por ambas se agrega con su origen y su motivo.
        List<SugerenciaEjerciciosDTO.EjercicioAEvitar> aEvitar = new ArrayList<>();
        for (Ejercicio e : catalogo) {
            List<String> riesgos = porRegla.getOrDefault(e.getIdEjercicio(), List.of());
            String motivo = motivosIa.get(e.getIdEjercicio());
            if (riesgos.isEmpty() && motivo == null) {
                continue;   // ni la regla ni la IA lo marcaron: es seguro, no se lista
            }
            // Origen: AMBOS (coinciden), REGLA (solo la regla del catálogo) o IA (solo lo sugiere el modelo).
            String origen = !riesgos.isEmpty() && motivo != null ? "AMBOS" : !riesgos.isEmpty() ? "REGLA" : "IA";
            aEvitar.add(SugerenciaEjerciciosDTO.EjercicioAEvitar.builder()
                    .idEjercicio(e.getIdEjercicio())
                    .nombre(e.getNombre())
                    .grupoMuscular(e.getGrupoMuscular().name())
                    // Si la IA no explicó el motivo (lo marcó solo la regla), se arma uno a partir de la regla.
                    .motivo(motivo != null && !motivo.isBlank() ? motivo : "Contraindicado por: " + String.join(", ", riesgos))
                    .origen(origen)
                    .riesgosRegla(riesgos)
                    .build());
        }
        // Primero lo que marca la regla firme, después lo que agrega la IA
        // (Boolean.compare: false < true, entonces los que NO son "IA" quedan primero).
        aEvitar.sort((a, b) -> Boolean.compare("IA".equals(a.getOrigen()), "IA".equals(b.getOrigen())));

        return SugerenciaEjerciciosDTO.builder()
                .patologias(patologias)
                .ejercicios(aEvitar)
                .recomendacion(recortar(r.path("recomendacion").asText(""), 600))
                .modelo(ollama.getModelo())
                .segundos(segundosDesde(inicio))
                .build();
    }

    // ---------- Prompts y esquemas ----------
    // El "prompt" son las instrucciones en lenguaje natural; el "esquema" (JSON Schema) es el formato
    // obligatorio de la respuesta. Se arman en el momento porque incluyen datos reales (etiquetas, catálogo).

    /**
     * Instrucciones para leer un certificado. Decisiones de redacción tomadas a partir de pruebas:
     * - Se define cada campo con su significado exacto (qué es null, qué es true/false).
     * - Para la fecha se da un EJEMPLO real ("2026-03-21") y no un patrón ("AAAA-MM-DD"): en las pruebas,
     *   un modelo copió literalmente el patrón en lugar de leer la fecha.
     * - "No inventes nada": reduce las "alucinaciones" (datos que no están en el documento).
     * - Las etiquetas se listan explícitamente con un ejemplo de equivalencia (hernia lumbar → HERNIA y LUMBAR).
     *
     * @param texto el texto extraído del PDF, o null si el certificado va como imagen
     */
    private static String promptCertificado(String texto, List<String> etiquetas) {
        // Text block (""" ... """) de Java: texto de varias líneas legible. %s se reemplaza con formatted(...)
        // por una frase distinta según si el certificado es texto o imagen.
        StringBuilder p = new StringBuilder("""
                Sos un asistente de un gimnasio. %s
                Extraé los datos en JSON, en español:
                - pacienteNombre: nombre de la persona a la que se le hizo el certificado, o null si no figura.
                - pacienteDni: su DNI (solo los números), o null si no figura.
                - apto: true si el médico autoriza la actividad física, false si no la autoriza, null si no lo dice.
                - fechaEmision: la fecha del certificado con formato año-mes-día (por ejemplo 2026-03-21), o null si no figura.
                - patologias: cada condición médica mencionada, en pocas palabras (por ejemplo "Hernia de disco L4-L5").
                - restricciones: lo que el médico indica evitar o cuidar.
                - resumen: 2 o 3 oraciones para el profesor del gimnasio sobre la condición del socio y qué cuidar.
                """.formatted(texto != null
                ? "Este es el texto de un certificado médico."
                : "La imagen es un certificado médico (puede tener partes escritas a mano)."));
        // Las etiquetas solo se piden si el catálogo tiene contraindicaciones cargadas.
        if (!etiquetas.isEmpty()) {
            p.append("- etiquetas: de esta lista, las zonas o condiciones que el certificado menciona o implica ")
                    .append("(por ejemplo, una hernia de disco lumbar corresponde a HERNIA y LUMBAR): ")
                    .append(String.join(", ", etiquetas)).append(". Si no corresponde ninguna, lista vacía.\n");
        }
        p.append("Si el certificado no menciona ninguna patología, devolvé las listas vacías. No inventes nada que no esté en el certificado.\n");
        // Si hay texto (PDF digital), va al final del prompt. Si es imagen, la imagen viaja aparte (campo "images").
        if (texto != null) {
            p.append("\nCERTIFICADO:\n").append(texto);
        }
        return p.toString();
    }

    /**
     * JSON Schema de la respuesta del certificado. Se arma con Maps de Java que Jackson convierte a JSON.
     * - ["string", "null"]: el campo puede ser texto o null (cuando el dato no figura).
     * - "enum" en etiquetas: lista cerrada → el modelo no puede inventar zonas que el catálogo no conoce.
     * - "required" con todos los campos: la respuesta siempre trae todos, aunque sea vacíos o null.
     */
    private static Map<String, Object> esquemaCertificado(List<String> etiquetas) {
        Map<String, Object> textos = Map.of("type", "array", "items", Map.of("type", "string"));   // lista de textos (se reutiliza)
        Map<String, Object> props = new LinkedHashMap<>();   // LinkedHashMap: conserva el orden de los campos
        props.put("pacienteNombre", Map.of("type", List.of("string", "null")));
        props.put("pacienteDni", Map.of("type", List.of("string", "null")));
        props.put("apto", Map.of("type", List.of("boolean", "null")));
        props.put("fechaEmision", Map.of("type", List.of("string", "null")));
        props.put("patologias", textos);
        props.put("etiquetas", etiquetas.isEmpty() ? textos
                : Map.of("type", "array", "items", Map.of("type", "string", "enum", etiquetas)));
        props.put("restricciones", textos);
        props.put("resumen", Map.of("type", "string"));
        // List.copyOf(props.keySet()): todos los nombres de campos como obligatorios.
        return Map.of("type", "object", "properties", props, "required", List.copyOf(props.keySet()));
    }

    /**
     * Instrucciones para sugerir ejercicios a evitar. Le da al modelo un "rol" (profesor que cuida la prevención
     * de lesiones), la condición del socio y el catálogo como tabla con separadores "|" (formato compacto y
     * fácil de leer para el modelo). Incluye las contraindicaciones del catálogo para que razone con la misma
     * información que la regla firme, pero pueda detectar riesgos que la regla no tiene cargados.
     */
    private static String promptEjercicios(String patologias, String resumen, List<Ejercicio> catalogo) {
        StringBuilder p = new StringBuilder("""
                Sos un profesor de educación física que cuida la prevención de lesiones.
                Un socio del gimnasio tiene esta condición según su certificado médico:
                """);
        if (!vacio(patologias)) {
            p.append("Patologías: ").append(patologias).append('\n');
        }
        if (!vacio(resumen)) {
            p.append("Resumen: ").append(resumen).append('\n');
        }
        p.append("\nCatálogo de ejercicios del gimnasio (id | nombre | grupo muscular | descripción | contraindicado para):\n");
        for (Ejercicio e : catalogo) {
            // Una línea por ejercicio. La descripción se corta en 90 caracteres para que el prompt no sea enorme.
            p.append(e.getIdEjercicio()).append(" | ").append(e.getNombre()).append(" | ").append(e.getGrupoMuscular())
                    .append(" | ").append(recortar(e.getDescripcion() == null ? "" : e.getDescripcion(), 90))
                    .append(" | ").append(vacio(e.getPatologiasContraindicadas()) ? "-" : e.getPatologiasContraindicadas())
                    .append('\n');
        }
        p.append("""

                Elegí SOLO los ejercicios de este catálogo que el socio no debería hacer, o que solo debería hacer con
                adaptaciones, por su condición. Para cada uno indicá el id y un motivo corto (una oración en español
                para el profesor). No incluyas ejercicios que sean seguros para él. Si ninguno es riesgoso, devolvé
                la lista vacía.
                recomendacion: una o dos oraciones con un consejo general para armarle la rutina.""");
        return p.toString();
    }

    /**
     * JSON Schema de la sugerencia de ejercicios. La clave es el "enum" con los ids del catálogo:
     * el modelo solo puede responder con ejercicios que el gimnasio realmente tiene.
     */
    private static Map<String, Object> esquemaEjercicios(List<Long> ids) {
        Map<String, Object> item = Map.of(
                "type", "object",
                "properties", Map.of(
                        "idEjercicio", Map.of("type", "integer", "enum", ids),
                        "motivo", Map.of("type", "string")),
                "required", List.of("idEjercicio", "motivo"));
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "ejercicios", Map.of("type", "array", "items", item),
                        "recomendacion", Map.of("type", "string")),
                "required", List.of("ejercicios", "recomendacion"));
    }

    // ---------- Utilidades ----------

    /**
     * Lo que recepción tiene que mirar antes de guardar: un certificado de otra persona (el error más común
     * al subir archivos), uno que dice "no apto", uno vencido o sin fecha legible.
     *
     * <p>Es "static" porque no usa datos de la clase (lógica pura): se puede probar de forma aislada.
     * Estas reglas se calculan en Java y no se le piden a la IA porque son críticas y deben ser exactas.</p>
     */
    static List<String> advertencias(String dniEsperado, String pacienteNombre, String pacienteDni,
                                     Boolean apto, LocalDate fechaEmision) {
        List<String> avisos = new ArrayList<>();
        // Solo dígitos en los dos lados, así "30.000.011" y "30000011" se consideran iguales.
        String esperado = dniEsperado == null ? "" : dniEsperado.replaceAll("\\D", "");
        // Se compara solo si se conocen los dos DNI (si el certificado no tiene DNI legible, no se acusa en falso).
        if (!esperado.isEmpty() && !pacienteDni.isEmpty() && !esperado.equals(pacienteDni)) {
            avisos.add("El certificado parece ser de otra persona: figura "
                    + (pacienteNombre.isEmpty() ? "" : pacienteNombre + ", ") + "DNI " + pacienteDni
                    + " (el socio tiene DNI " + esperado + ")");
        }
        // Boolean.FALSE.equals(apto): seguro ante null (null = "no lo dice", no se avisa).
        if (Boolean.FALSE.equals(apto)) {
            avisos.add("El certificado indica que NO está apto para la actividad física");
        }
        if (fechaEmision == null) {
            avisos.add("No se pudo leer la fecha de emisión: completala a mano");
        } else if (fechaEmision.plusDays(365).isBefore(LocalDate.now())) {
            // Misma regla que el sistema: un certificado vale 365 días (Ley 5397).
            avisos.add("El certificado tiene más de un año: está vencido");
        }
        return avisos;
    }

    // Zonas y condiciones que usan las contraindicaciones del catálogo (HOMBRO, RODILLA, LUMBAR...)
    // Se leen de la base cada vez: si el gimnasio carga una contraindicación nueva (ej. "TOBILLO"),
    // la IA la empieza a usar sola, sin tocar el código.
    private List<String> etiquetasDelCatalogo() {
        // TreeSet: no repite y mantiene orden alfabético (lista estable en el prompt).
        TreeSet<String> etiquetas = new TreeSet<>();
        for (Ejercicio e : ejercicioRepository.findAll()) {
            if (!vacio(e.getPatologiasContraindicadas())) {
                // Cada ejercicio guarda sus contraindicaciones separadas por coma, ej. "RODILLA,HERNIA,LUMBAR".
                for (String etiqueta : e.getPatologiasContraindicadas().split(",")) {
                    String normalizada = normalizar(etiqueta);
                    if (!normalizada.isEmpty()) {
                        etiquetas.add(normalizada);
                    }
                }
            }
        }
        return List.copyOf(etiquetas);   // lista inmutable
    }

    /**
     * Texto para el campo de patologías del certificado: las condiciones con sus palabras y, al final, las zonas
     * del catálogo que ninguna menciona. Así la regla firme del constructor también las detecta
     * (por ejemplo "Hernia de disco L4-L5" suma LUMBAR).
     *
     * <p>Por qué: la regla firme (RutinaService) marca un ejercicio si alguna patología del socio CONTIENE
     * alguna de sus contraindicaciones. "Hernia de disco L4-L5" contiene HERNIA, pero no LUMBAR: agregando
     * la etiqueta LUMBAR, la regla también bloquea los ejercicios lumbares.</p>
     */
    static String observaciones(List<String> patologias, List<String> etiquetas) {
        List<String> partes = new ArrayList<>(patologias);
        for (String etiqueta : etiquetas) {
            // Solo se agrega la etiqueta si ninguna patología ya la menciona (evita "Rodilla..., RODILLA").
            if (patologias.stream().noneMatch(p -> normalizar(p).contains(etiqueta))) {
                partes.add(etiqueta);
            }
        }
        // Se arma "a, b, c" sin pasar de 500 caracteres (el largo de la columna observaciones_patologias),
        // cortando entre elementos para no dejar una patología partida por la mitad.
        StringBuilder texto = new StringBuilder();
        for (String parte : partes) {
            if (texto.length() + parte.length() + 2 > 500) {
                break;
            }
            texto.append(texto.isEmpty() ? "" : ", ").append(parte);
        }
        return texto.toString();
    }

    // El campo de patologías se separa por comas: una coma dentro de una patología la partiría en dos
    // Convierte un arreglo JSON en una lista Java limpia: sin comas internas, recortada, sin vacíos ni repetidos
    // y con una cantidad máxima de elementos.
    private static List<String> lista(JsonNode nodo, int maximo, int largoMaximo) {
        List<String> valores = new ArrayList<>();
        for (JsonNode item : nodo) {
            String valor = recortar(item.asText("").replace(",", " -").strip(), largoMaximo);
            if (!valor.isEmpty() && !valores.contains(valor) && valores.size() < maximo) {
                valores.add(valor);
            }
        }
        return valores;
    }

    // Una fecha ilegible o futura se descarta: el personal la completa a mano
    // (un certificado no puede tener fecha futura: si el modelo la devuelve, casi seguro leyó mal).
    private static LocalDate fecha(String texto) {
        if (vacio(texto)) {
            return null;
        }
        try {
            // LocalDate.parse espera el formato ISO año-mes-día (el que pedimos en el prompt).
            LocalDate fecha = LocalDate.parse(texto.strip());
            return fecha.isAfter(LocalDate.now()) ? null : fecha;
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    // JPG y PNG grandes (fotos del celular) se achican: el modelo no necesita más detalle y responde antes
    // Devuelve la imagen en base64 (texto), que es el formato en que Ollama recibe imágenes.
    private static String imagenParaModelo(byte[] contenido) {
        try {
            BufferedImage imagen = ImageIO.read(new ByteArrayInputStream(contenido));
            if (imagen == null) {
                return Base64.getEncoder().encodeToString(contenido); // WEBP: Java no lo lee, va tal cual
            }
            int lado = Math.max(imagen.getWidth(), imagen.getHeight());
            if (lado <= MAX_LADO_IMAGEN) {
                return Base64.getEncoder().encodeToString(contenido);   // ya es chica: se envía sin tocar
            }
            // Escala proporcional para que el lado mayor quede en 1600 px (no se deforma la imagen).
            double escala = (double) MAX_LADO_IMAGEN / lado;
            BufferedImage chica = new BufferedImage((int) (imagen.getWidth() * escala), (int) (imagen.getHeight() * escala),
                    BufferedImage.TYPE_INT_RGB);
            Graphics2D g = chica.createGraphics();
            // Interpolación bilineal: suaviza al achicar y mantiene la letra legible (mejor que "vecino más cercano").
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(imagen, 0, 0, chica.getWidth(), chica.getHeight(), null);
            g.dispose();   // libera los recursos gráficos
            ByteArrayOutputStream salida = new ByteArrayOutputStream();
            ImageIO.write(chica, "jpg", salida);   // JPG: mucho más liviano que PNG para fotos
            return Base64.getEncoder().encodeToString(salida.toByteArray());
        } catch (IOException e) {
            throw new IllegalArgumentException("No se pudo leer la imagen del certificado");
        }
    }

    // Convierte una página renderizada del PDF a PNG en base64 (PNG: sin pérdida, mejor para texto escaneado).
    private static String base64(BufferedImage imagen) throws IOException {
        ByteArrayOutputStream salida = new ByteArrayOutputStream();
        ImageIO.write(imagen, "png", salida);
        return Base64.getEncoder().encodeToString(salida.toByteArray());
    }

    // "Lumbar" → "LUMBAR", "Lesión" → "LESION": quita tildes (NFD separa la letra de su tilde y \p{M} borra
    // las tildes) y pasa a mayúsculas. Es el mismo criterio que usa la regla firme, así comparan igual.
    private static String normalizar(String texto) {
        return Normalizer.normalize(texto.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "").toUpperCase();
    }

    // Corta textos largos agregando "…": protege los largos de las columnas de la base y de la pantalla.
    private static String recortar(String texto, int maximo) {
        String limpio = texto == null ? "" : texto.strip();
        return limpio.length() <= maximo ? limpio : limpio.substring(0, maximo - 1).strip() + "…";
    }

    // null o solo espacios.
    private static boolean vacio(String texto) {
        return texto == null || texto.isBlank();
    }

    // Segundos transcurridos con un decimal (nanosegundos / 1e8 = décimas de segundo, redondeadas, / 10).
    private static double segundosDesde(long inicio) {
        return Math.round((System.nanoTime() - inicio) / 1e8) / 10.0;
    }
}
