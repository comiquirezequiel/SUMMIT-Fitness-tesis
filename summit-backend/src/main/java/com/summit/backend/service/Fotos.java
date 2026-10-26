package com.summit.backend.service;

import org.springframework.web.multipart.MultipartFile;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.Iterator;

/**
 * Fotos de personas (socios y profesores): se revisan y se vuelven a codificar como JPG de hasta LADO_MAXIMO px.
 * Así se descartan los datos ocultos que traen las fotos de celular (por ejemplo, el lugar donde se sacó) y todas
 * ocupan poco.
 */
public final class Fotos {

    private static final int LADO_MAXIMO = 600;
    private static final int LADO_MINIMO = 120;
    // Tope antes de abrir la imagen: una imagen chica en bytes puede declarar un tamaño enorme y llenar la memoria
    private static final long PIXELES_MAXIMOS = 16_000_000L;
    private static final float CALIDAD_JPG = 0.85f;
    private static final String NO_SE_PUDO_LEER = "No se pudo leer la imagen: probá con otra foto";

    private Fotos() {
    }

    /**
     * La versión de una foto es el momento en que se sacó, en milisegundos: cambia con cada foto nueva, así que se
     * puede usar en la dirección de la imagen y el navegador nunca muestra una vieja.
     */
    public static long version(LocalDateTime fecha) {
        return fecha == null ? 0L : fecha.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    /**
     * Controla que sea una foto JPG o PNG de tamaño razonable y la devuelve como JPG de hasta LADO_MAXIMO px.
     *
     * @throws IllegalArgumentException con un mensaje para mostrar si no sirve
     */
    public static byte[] normalizar(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("Adjuntá la foto");
        }
        byte[] contenido;
        try {
            contenido = archivo.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("No se pudo leer la foto", e);
        }
        // Se mira el contenido, no la extensión ni el tipo que declara el navegador (ver ArchivoService.tipoDe)
        String tipo = ArchivoService.tipoDe(Arrays.copyOf(contenido, Math.min(12, contenido.length)));
        if (!"image/jpeg".equals(tipo) && !"image/png".equals(tipo)) {
            throw new IllegalArgumentException("Formato no permitido: la foto tiene que ser JPG o PNG");
        }
        BufferedImage original = leer(contenido);
        if (Math.min(original.getWidth(), original.getHeight()) < LADO_MINIMO) {
            throw new IllegalArgumentException("La foto es muy chica: tiene que tener al menos " + LADO_MINIMO + " px de lado");
        }

        double escala = Math.min(1.0, (double) LADO_MAXIMO / Math.max(original.getWidth(), original.getHeight()));
        int ancho = (int) Math.round(original.getWidth() * escala);
        int alto = (int) Math.round(original.getHeight() * escala);
        // Fondo blanco y sin transparencia: las partes transparentes de un PNG saldrían negras en el JPG
        BufferedImage foto = new BufferedImage(ancho, alto, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = foto.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, ancho, alto);
            g.drawImage(original, 0, 0, ancho, alto, null);
        } finally {
            g.dispose();
        }
        return aJpg(foto);
    }

    // Abre la imagen mirando antes su tamaño declarado (ver PIXELES_MAXIMOS). En memoria: con un stream común,
    // ImageIO usa archivos temporales en disco
    private static BufferedImage leer(byte[] contenido) {
        try (ImageInputStream entrada = new MemoryCacheImageInputStream(new ByteArrayInputStream(contenido))) {
            Iterator<ImageReader> lectores = ImageIO.getImageReaders(entrada);
            if (!lectores.hasNext()) {
                throw new IllegalArgumentException(NO_SE_PUDO_LEER);
            }
            ImageReader lector = lectores.next();
            try {
                lector.setInput(entrada, true, true);
                if ((long) lector.getWidth(0) * lector.getHeight(0) > PIXELES_MAXIMOS) {
                    throw new IllegalArgumentException("La foto es demasiado grande: sacala o subila desde el panel, que la achica sola");
                }
                try {
                    return lector.read(0);
                } catch (RuntimeException e) {
                    throw new IllegalArgumentException(NO_SE_PUDO_LEER);
                }
            } finally {
                lector.dispose();
            }
        } catch (IOException e) {
            // Imagen dañada o con un formato interno que Java no lee (por ejemplo, JPG en CMYK)
            throw new IllegalArgumentException(NO_SE_PUDO_LEER);
        }
    }

    private static byte[] aJpg(BufferedImage foto) {
        ImageWriter escritor = ImageIO.getImageWritersByFormatName("jpg").next();
        ImageWriteParam parametros = escritor.getDefaultWriteParam();
        parametros.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        parametros.setCompressionQuality(CALIDAD_JPG);
        ByteArrayOutputStream salida = new ByteArrayOutputStream();
        try (ImageOutputStream destino = new MemoryCacheImageOutputStream(salida)) {
            escritor.setOutput(destino);
            escritor.write(null, new IIOImage(foto, null, null), parametros);
        } catch (IOException e) {
            throw new RuntimeException("No se pudo procesar la foto", e);
        } finally {
            escritor.dispose();
        }
        return salida.toByteArray();
    }

    // ---- Logo del gimnasio ----

    private static final int LADO_MAXIMO_LOGO = 512;
    private static final int LADO_MINIMO_LOGO = 48;

    /**
     * Controla que el logo sea JPG o PNG y lo devuelve como PNG de hasta LADO_MAXIMO_LOGO px, sin deformarlo y con su
     * transparencia (a diferencia de las fotos de personas, que pasan a JPG con fondo blanco).
     *
     * @throws IllegalArgumentException con un mensaje para mostrar si no sirve
     */
    public static byte[] normalizarLogo(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("Adjuntá el logo");
        }
        byte[] contenido;
        try {
            contenido = archivo.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("No se pudo leer el logo", e);
        }
        String tipo = ArchivoService.tipoDe(Arrays.copyOf(contenido, Math.min(12, contenido.length)));
        if (!"image/jpeg".equals(tipo) && !"image/png".equals(tipo)) {
            throw new IllegalArgumentException("Formato no permitido: el logo tiene que ser PNG o JPG");
        }
        BufferedImage original = leer(contenido);
        if (Math.max(original.getWidth(), original.getHeight()) < LADO_MINIMO_LOGO) {
            throw new IllegalArgumentException("El logo es muy chico: tiene que tener al menos " + LADO_MINIMO_LOGO + " px de lado");
        }
        double escala = Math.min(1.0, (double) LADO_MAXIMO_LOGO / Math.max(original.getWidth(), original.getHeight()));
        int ancho = Math.max(1, (int) Math.round(original.getWidth() * escala));
        int alto = Math.max(1, (int) Math.round(original.getHeight() * escala));
        BufferedImage logo = new BufferedImage(ancho, alto, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = logo.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(original, 0, 0, ancho, alto, null);
        } finally {
            g.dispose();
        }
        ByteArrayOutputStream salida = new ByteArrayOutputStream();
        try {
            ImageIO.write(logo, "png", salida);
        } catch (IOException e) {
            throw new RuntimeException("No se pudo procesar el logo", e);
        }
        return salida.toByteArray();
    }
}
