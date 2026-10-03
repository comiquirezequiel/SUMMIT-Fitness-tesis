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
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

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
 */
@Service
@RequiredArgsConstructor
public class AsistenteIaService {

    // Menos texto que esto en un PDF = está escaneado (es una imagen): se manda la página como imagen
    private static final int MIN_TEXTO_PDF = 40;
    private static final int MAX_LADO_IMAGEN = 1600;
    private static final int MAX_PAGINAS_ESCANEADAS = 2;
    private static final int MAX_EJERCICIOS_EN_PROMPT = 150;

    private final OllamaClient ollama;
    private final ArchivoService archivoService;
    private final CertificadoMedicoService certificadoMedicoService;
    private final CertificadoMedicoRepository certificadoMedicoRepository;
    private final EjercicioRepository ejercicioRepository;
    private final UsuarioRepository usuarioRepository;
    private final RutinaService rutinaService;

    public OllamaClient.Estado estado() {
        return ollama.estado();
    }

    /**
     * Analiza un certificado antes de subirlo (no guarda nada).
     *
     * @param dniEsperado DNI del socio (si se conoce) para avisar si el certificado es de otra persona
     */
    public AnalisisCertificadoDTO analizarArchivo(MultipartFile archivo, String dniEsperado) {
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("Adjuntá el certificado (PDF o imagen)");
        }
        try {
            return analizar(archivo.getBytes(), dniEsperado);
        } catch (IOException e) {
            throw new IllegalArgumentException("No se pudo leer el archivo");
        }
    }

    /**
     * Analiza un certificado ya cargado en la ficha del socio (no guarda nada).
     */
    @Transactional(readOnly = true)
    public AnalisisCertificadoDTO analizarGuardado(Long idSocio, Long idCertificado) {
        CertificadoMedico certificado = certificadoMedicoService.buscarDelSocio(idSocio, idCertificado);
        return analizar(archivoService.leer(certificado.getArchivoUrl()), certificado.getUsuario().getDni());
    }

    private AnalisisCertificadoDTO analizar(byte[] contenido, String dniEsperado) {
        String tipo = ArchivoService.tipoDe(Arrays.copyOf(contenido, Math.min(12, contenido.length)));
        if (tipo == null) {
            throw new IllegalArgumentException("Formato no permitido: subí un PDF, JPG, PNG o WEBP");
        }
        long inicio = System.nanoTime();
        List<String> etiquetas = etiquetasDelCatalogo();

        String texto = null;
        List<String> imagenes = new ArrayList<>();
        String fuente;
        if ("application/pdf".equals(tipo)) {
            try (PDDocument pdf = Loader.loadPDF(contenido)) {
                PDFTextStripper extractor = new PDFTextStripper();
                extractor.setEndPage(3);
                String extraido = extractor.getText(pdf).strip();
                if (extraido.replaceAll("\\s+", "").length() >= MIN_TEXTO_PDF) {
                    texto = extraido.length() > 6000 ? extraido.substring(0, 6000) : extraido;
                    fuente = "TEXTO_PDF";
                } else {
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
            imagenes.add(imagenParaModelo(contenido));
            fuente = "IMAGEN";
        }

        JsonNode r = ollama.generarJson(promptCertificado(texto, etiquetas), imagenes, esquemaCertificado(etiquetas));

        List<String> patologias = lista(r.path("patologias"), 10, 80);
        Boolean apto = r.path("apto").isBoolean() ? r.path("apto").asBoolean() : null;
        LocalDate fechaEmision = fecha(r.path("fechaEmision").asText(null));
        String pacienteNombre = recortar(r.path("pacienteNombre").asText(""), 100);
        String pacienteDni = r.path("pacienteDni").asText("").replaceAll("\\D", "");
        List<String> etiquetasDetectadas = lista(r.path("etiquetas"), 10, 30).stream()
                .map(AsistenteIaService::normalizar).filter(etiquetas::contains).distinct().toList();
        return AnalisisCertificadoDTO.builder()
                .pacienteNombre(pacienteNombre.isEmpty() ? null : pacienteNombre)
                .pacienteDni(pacienteDni.isEmpty() ? null : pacienteDni)
                .advertencias(advertencias(dniEsperado, pacienteNombre, pacienteDni, apto, fechaEmision))
                .apto(apto)
                .fechaEmision(fechaEmision)
                .patologias(patologias)
                .etiquetas(etiquetasDetectadas)
                .restricciones(lista(r.path("restricciones"), 10, 150))
                .resumen(recortar(r.path("resumen").asText(""), 1000))
                .observacionesSugeridas(observaciones(patologias, etiquetasDetectadas))
                .fuente(fuente)
                .modelo(ollama.getModelo())
                .segundos(segundosDesde(inicio))
                .build();
    }

    /**
     * Ejercicios del catálogo que el socio debería evitar: los de la regla firme y los que sugiere la IA,
     * a partir de las patologías y el resumen guardados en su certificado.
     */
    @Transactional(readOnly = true)
    public SugerenciaEjerciciosDTO ejerciciosAEvitar(Long idSocio) {
        usuarioRepository.findById(idSocio)
                .filter(u -> u.getRol() == Rol.SOCIO)
                .orElseThrow(() -> new NoSuchElementException("Socio no encontrado"));
        CertificadoMedico certificado = certificadoMedicoRepository
                .findFirstByUsuarioIdUsuarioOrderByFechaVencimientoDesc(idSocio).orElse(null);
        String patologias = certificado != null ? certificado.getObservacionesPatologias() : null;
        String resumen = certificado != null ? certificado.getResumenIa() : null;
        if (vacio(patologias) && vacio(resumen)) {
            throw new IllegalArgumentException("El socio no tiene patologías cargadas en su certificado: no hay ejercicios para evitar");
        }
        List<Ejercicio> catalogo = ejercicioRepository.findAll(Sort.by("nombre"));
        if (catalogo.isEmpty()) {
            throw new IllegalArgumentException("El catálogo de ejercicios está vacío");
        }
        List<Ejercicio> enPrompt = catalogo.subList(0, Math.min(MAX_EJERCICIOS_EN_PROMPT, catalogo.size()));
        Map<Long, List<String>> porRegla = rutinaService.contraindicadosPorRegla(idSocio);

        long inicio = System.nanoTime();
        JsonNode r = ollama.generarJson(promptEjercicios(patologias, resumen, enPrompt), List.of(),
                esquemaEjercicios(enPrompt.stream().map(Ejercicio::getIdEjercicio).toList()));

        // Solo ids que existen en el catálogo (el modelo no puede agregar ejercicios inventados)
        Map<Long, String> motivosIa = new LinkedHashMap<>();
        for (JsonNode item : r.path("ejercicios")) {
            long id = item.path("idEjercicio").asLong(-1);
            if (enPrompt.stream().anyMatch(e -> e.getIdEjercicio() == id)) {
                motivosIa.putIfAbsent(id, recortar(item.path("motivo").asText(""), 250));
            }
        }

        List<SugerenciaEjerciciosDTO.EjercicioAEvitar> aEvitar = new ArrayList<>();
        for (Ejercicio e : catalogo) {
            List<String> riesgos = porRegla.getOrDefault(e.getIdEjercicio(), List.of());
            String motivo = motivosIa.get(e.getIdEjercicio());
            if (riesgos.isEmpty() && motivo == null) {
                continue;
            }
            String origen = !riesgos.isEmpty() && motivo != null ? "AMBOS" : !riesgos.isEmpty() ? "REGLA" : "IA";
            aEvitar.add(SugerenciaEjerciciosDTO.EjercicioAEvitar.builder()
                    .idEjercicio(e.getIdEjercicio())
                    .nombre(e.getNombre())
                    .grupoMuscular(e.getGrupoMuscular().name())
                    .motivo(motivo != null && !motivo.isBlank() ? motivo : "Contraindicado por: " + String.join(", ", riesgos))
                    .origen(origen)
                    .riesgosRegla(riesgos)
                    .build());
        }
        // Primero lo que marca la regla firme, después lo que agrega la IA
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

    private static String promptCertificado(String texto, List<String> etiquetas) {
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
        if (!etiquetas.isEmpty()) {
            p.append("- etiquetas: de esta lista, las zonas o condiciones que el certificado menciona o implica ")
                    .append("(por ejemplo, una hernia de disco lumbar corresponde a HERNIA y LUMBAR): ")
                    .append(String.join(", ", etiquetas)).append(". Si no corresponde ninguna, lista vacía.\n");
        }
        p.append("Si el certificado no menciona ninguna patología, devolvé las listas vacías. No inventes nada que no esté en el certificado.\n");
        if (texto != null) {
            p.append("\nCERTIFICADO:\n").append(texto);
        }
        return p.toString();
    }

    private static Map<String, Object> esquemaCertificado(List<String> etiquetas) {
        Map<String, Object> textos = Map.of("type", "array", "items", Map.of("type", "string"));
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("pacienteNombre", Map.of("type", List.of("string", "null")));
        props.put("pacienteDni", Map.of("type", List.of("string", "null")));
        props.put("apto", Map.of("type", List.of("boolean", "null")));
        props.put("fechaEmision", Map.of("type", List.of("string", "null")));
        props.put("patologias", textos);
        props.put("etiquetas", etiquetas.isEmpty() ? textos
                : Map.of("type", "array", "items", Map.of("type", "string", "enum", etiquetas)));
        props.put("restricciones", textos);
        props.put("resumen", Map.of("type", "string"));
        return Map.of("type", "object", "properties", props, "required", List.copyOf(props.keySet()));
    }

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
     */
    static List<String> advertencias(String dniEsperado, String pacienteNombre, String pacienteDni,
                                     Boolean apto, LocalDate fechaEmision) {
        List<String> avisos = new ArrayList<>();
        String esperado = dniEsperado == null ? "" : dniEsperado.replaceAll("\\D", "");
        if (!esperado.isEmpty() && !pacienteDni.isEmpty() && !esperado.equals(pacienteDni)) {
            avisos.add("El certificado parece ser de otra persona: figura "
                    + (pacienteNombre.isEmpty() ? "" : pacienteNombre + ", ") + "DNI " + pacienteDni
                    + " (el socio tiene DNI " + esperado + ")");
        }
        if (Boolean.FALSE.equals(apto)) {
            avisos.add("El certificado indica que NO está apto para la actividad física");
        }
        if (fechaEmision == null) {
            avisos.add("No se pudo leer la fecha de emisión: completala a mano");
        } else if (fechaEmision.plusDays(365).isBefore(LocalDate.now())) {
            avisos.add("El certificado tiene más de un año: está vencido");
        }
        return avisos;
    }

    // Zonas y condiciones que usan las contraindicaciones del catálogo (HOMBRO, RODILLA, LUMBAR...)
    private List<String> etiquetasDelCatalogo() {
        TreeSet<String> etiquetas = new TreeSet<>();
        for (Ejercicio e : ejercicioRepository.findAll()) {
            if (!vacio(e.getPatologiasContraindicadas())) {
                for (String etiqueta : e.getPatologiasContraindicadas().split(",")) {
                    String normalizada = normalizar(etiqueta);
                    if (!normalizada.isEmpty()) {
                        etiquetas.add(normalizada);
                    }
                }
            }
        }
        return List.copyOf(etiquetas);
    }

    /**
     * Texto para el campo de patologías del certificado: las condiciones con sus palabras y, al final, las zonas
     * del catálogo que ninguna menciona. Así la regla firme del constructor también las detecta
     * (por ejemplo "Hernia de disco L4-L5" suma LUMBAR).
     */
    static String observaciones(List<String> patologias, List<String> etiquetas) {
        List<String> partes = new ArrayList<>(patologias);
        for (String etiqueta : etiquetas) {
            if (patologias.stream().noneMatch(p -> normalizar(p).contains(etiqueta))) {
                partes.add(etiqueta);
            }
        }
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
    private static LocalDate fecha(String texto) {
        if (vacio(texto)) {
            return null;
        }
        try {
            LocalDate fecha = LocalDate.parse(texto.strip());
            return fecha.isAfter(LocalDate.now()) ? null : fecha;
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    // JPG y PNG grandes (fotos del celular) se achican: el modelo no necesita más detalle y responde antes
    private static String imagenParaModelo(byte[] contenido) {
        try {
            BufferedImage imagen = ImageIO.read(new ByteArrayInputStream(contenido));
            if (imagen == null) {
                return Base64.getEncoder().encodeToString(contenido); // WEBP: Java no lo lee, va tal cual
            }
            int lado = Math.max(imagen.getWidth(), imagen.getHeight());
            if (lado <= MAX_LADO_IMAGEN) {
                return Base64.getEncoder().encodeToString(contenido);
            }
            double escala = (double) MAX_LADO_IMAGEN / lado;
            BufferedImage chica = new BufferedImage((int) (imagen.getWidth() * escala), (int) (imagen.getHeight() * escala),
                    BufferedImage.TYPE_INT_RGB);
            Graphics2D g = chica.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(imagen, 0, 0, chica.getWidth(), chica.getHeight(), null);
            g.dispose();
            ByteArrayOutputStream salida = new ByteArrayOutputStream();
            ImageIO.write(chica, "jpg", salida);
            return Base64.getEncoder().encodeToString(salida.toByteArray());
        } catch (IOException e) {
            throw new IllegalArgumentException("No se pudo leer la imagen del certificado");
        }
    }

    private static String base64(BufferedImage imagen) throws IOException {
        ByteArrayOutputStream salida = new ByteArrayOutputStream();
        ImageIO.write(imagen, "png", salida);
        return Base64.getEncoder().encodeToString(salida.toByteArray());
    }

    private static String normalizar(String texto) {
        return Normalizer.normalize(texto.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "").toUpperCase();
    }

    private static String recortar(String texto, int maximo) {
        String limpio = texto == null ? "" : texto.strip();
        return limpio.length() <= maximo ? limpio : limpio.substring(0, maximo - 1).strip() + "…";
    }

    private static boolean vacio(String texto) {
        return texto == null || texto.isBlank();
    }

    private static double segundosDesde(long inicio) {
        return Math.round((System.nanoTime() - inicio) / 1e8) / 10.0;
    }
}
