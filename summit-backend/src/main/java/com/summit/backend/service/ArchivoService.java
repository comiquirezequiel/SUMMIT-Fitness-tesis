package com.summit.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

/**
 * Guarda y entrega los archivos subidos (certificados médicos, comprobantes).
 * Los archivos quedan fuera del repositorio, en la carpeta summit.uploads.dir.
 */
@Service
@Slf4j
public class ArchivoService {

    // Tipos permitidos (PDF o imagen) y la extensión con la que se guardan
    private static final Map<String, String> EXTENSIONES = Map.of(
            "application/pdf", ".pdf",
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");

    private final Path directorioBase;

    public ArchivoService(@Value("${summit.uploads.dir}") String directorio) throws IOException {
        this.directorioBase = Paths.get(directorio).toAbsolutePath().normalize();
        Files.createDirectories(directorioBase);
    }

    public record Archivo(Resource recurso, String tipo, String nombre) {}

    /**
     * Guarda un PDF o una imagen y devuelve la ruta relativa (ej. "certificados/socio-4-uuid.pdf").
     */
    public String guardar(MultipartFile archivo, String carpeta, String prefijo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("Adjuntá el archivo (PDF o imagen)");
        }
        String tipo = detectarTipo(archivo);
        String rutaRelativa = carpeta + "/" + prefijo + "-" + UUID.randomUUID() + EXTENSIONES.get(tipo);
        Path destino = resolver(rutaRelativa);
        try (InputStream in = archivo.getInputStream()) {
            Files.createDirectories(destino.getParent());
            Files.copy(in, destino);
        } catch (IOException e) {
            throw new RuntimeException("No se pudo guardar el archivo", e);
        }
        return rutaRelativa;
    }

    public Archivo cargar(String rutaRelativa) {
        Path ruta = resolver(rutaRelativa);
        if (!Files.isRegularFile(ruta)) {
            throw new IllegalStateException("El archivo no está disponible");
        }
        String nombre = ruta.getFileName().toString();
        String tipo = EXTENSIONES.entrySet().stream()
                .filter(e -> nombre.endsWith(e.getValue()))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse("application/octet-stream");
        return new Archivo(new FileSystemResource(ruta), tipo, nombre);
    }

    public void eliminar(String rutaRelativa) {
        try {
            Files.deleteIfExists(resolver(rutaRelativa));
        } catch (IOException e) {
            log.warn("No se pudo eliminar el archivo {}", rutaRelativa, e);
        }
    }

    // Evita que una ruta con "../" salga de la carpeta de archivos (path traversal)
    private Path resolver(String rutaRelativa) {
        Path ruta = directorioBase.resolve(rutaRelativa).normalize();
        if (!ruta.startsWith(directorioBase)) {
            throw new IllegalArgumentException("Ruta de archivo inválida");
        }
        return ruta;
    }

    /**
     * Contenido completo de un archivo guardado (por ejemplo, para que el asistente de IA lea un certificado).
     */
    public byte[] leer(String rutaRelativa) {
        Path ruta = resolver(rutaRelativa);
        if (!Files.isRegularFile(ruta)) {
            throw new IllegalStateException("El archivo no está disponible");
        }
        try {
            return Files.readAllBytes(ruta);
        } catch (IOException e) {
            throw new RuntimeException("No se pudo leer el archivo", e);
        }
    }

    // Se revisa la firma del contenido, no la extensión ni el tipo que declara el navegador
    private String detectarTipo(MultipartFile archivo) {
        byte[] c = new byte[12];
        int leidos;
        try (InputStream in = archivo.getInputStream()) {
            leidos = in.readNBytes(c, 0, c.length);
        } catch (IOException e) {
            throw new RuntimeException("No se pudo leer el archivo", e);
        }
        String tipo = tipoDe(java.util.Arrays.copyOf(c, leidos));
        if (tipo == null) {
            throw new IllegalArgumentException("Formato no permitido: subí un PDF, JPG, PNG o WEBP");
        }
        return tipo;
    }

    /**
     * Tipo real (PDF, JPG, PNG o WEBP) según los primeros bytes del contenido; null si no es ninguno.
     */
    public static String tipoDe(byte[] c) {
        int leidos = c.length;
        if (leidos >= 4 && c[0] == '%' && c[1] == 'P' && c[2] == 'D' && c[3] == 'F') {
            return "application/pdf";
        }
        if (leidos >= 3 && (c[0] & 0xFF) == 0xFF && (c[1] & 0xFF) == 0xD8 && (c[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (leidos >= 4 && (c[0] & 0xFF) == 0x89 && c[1] == 'P' && c[2] == 'N' && c[3] == 'G') {
            return "image/png";
        }
        if (leidos >= 12 && c[0] == 'R' && c[1] == 'I' && c[2] == 'F' && c[3] == 'F'
                && c[8] == 'W' && c[9] == 'E' && c[10] == 'B' && c[11] == 'P') {
            return "image/webp";
        }
        return null;
    }
}
