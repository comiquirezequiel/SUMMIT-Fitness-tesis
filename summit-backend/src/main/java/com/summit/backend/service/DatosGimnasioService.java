package com.summit.backend.service;

import com.summit.backend.dto.DatosGimnasioDTO;
import com.summit.backend.model.DatosGimnasio;
import com.summit.backend.repository.DatosGimnasioRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Datos del gimnasio (Ajustes > Datos del gimnasio): nombre, contacto y logo, que salen en los PDF.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DatosGimnasioService {

    private static final Long ID = 1L;
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern TELEFONO = Pattern.compile("^[0-9+()\\-\\s]{6,25}$");
    private static final Pattern INSTAGRAM = Pattern.compile("^[A-Za-z0-9._]{1,30}$");

    private final DatosGimnasioRepository repository;
    private final ArchivoService archivoService;

    /**
     * Crea los datos por defecto la primera vez (solo el nombre), hasta que el admin cargue los reales.
     */
    @PostConstruct
    public void crearSiNoExisten() {
        if (repository.existsById(ID)) {
            return;
        }
        log.info("Creando los datos del gimnasio por defecto...");
        repository.save(DatosGimnasio.builder().idDatos(ID).nombre("SUMMIT Fitness").build());
    }

    public DatosGimnasio obtener() {
        return repository.findById(ID).orElseThrow(() -> new IllegalStateException("Faltan los datos del gimnasio"));
    }

    public DatosGimnasioDTO obtenerDTO() {
        return aDTO(obtener());
    }

    /**
     * Guarda lo que manda el panel, después de revisarlo. Los textos vacíos quedan en null.
     *
     * @throws IllegalArgumentException con un mensaje para mostrar si algún dato no es válido
     */
    public DatosGimnasioDTO actualizar(DatosGimnasioDTO pedido) {
        if (pedido == null) {
            throw new IllegalArgumentException("Faltan los datos del gimnasio");
        }
        DatosGimnasio datos = obtener();
        String nombre = texto(pedido.nombre());
        if (nombre == null) {
            throw new IllegalArgumentException("Escribí el nombre del gimnasio");
        }
        datos.setNombre(largoMaximo(nombre, 80, "El nombre"));
        datos.setDireccion(largoMaximo(texto(pedido.direccion()), 150, "La dirección"));
        datos.setCiudad(largoMaximo(texto(pedido.ciudad()), 80, "La ciudad"));

        String telefono = texto(pedido.telefono());
        if (telefono != null && !TELEFONO.matcher(telefono).matches()) {
            throw new IllegalArgumentException("El teléfono solo puede tener números, espacios, +, - y paréntesis");
        }
        datos.setTelefono(telefono);

        // WhatsApp: se guardan solo los dígitos (el link wa.me no acepta otra cosa)
        String whatsapp = texto(pedido.whatsapp());
        if (whatsapp != null) {
            whatsapp = whatsapp.replaceAll("\\D", "");
            if (whatsapp.length() < 10 || whatsapp.length() > 15) {
                throw new IllegalArgumentException("El WhatsApp tiene que tener el código de país y de área, sin 0 ni 15 "
                        + "(por ejemplo 5491123456789)");
            }
        }
        datos.setWhatsapp(whatsapp);

        String email = texto(pedido.email());
        if (email != null && (email.length() > 100 || !EMAIL.matcher(email).matches())) {
            throw new IllegalArgumentException("El email no es válido");
        }
        datos.setEmail(email);

        // Instagram: se acepta "@usuario" o el link del perfil, y se guarda solo el usuario
        String instagram = texto(pedido.instagram());
        if (instagram != null) {
            instagram = instagram.replaceFirst("^(https?://)?(www\\.)?instagram\\.com/", "").replaceFirst("^@", "")
                    .replaceAll("/+$", "");
            if (!INSTAGRAM.matcher(instagram).matches()) {
                throw new IllegalArgumentException("El usuario de Instagram solo puede tener letras, números, puntos y guiones bajos");
            }
        }
        datos.setInstagram(instagram);
        return aDTO(repository.save(datos));
    }

    private static DatosGimnasioDTO aDTO(DatosGimnasio d) {
        return new DatosGimnasioDTO(d.getNombre(), d.getDireccion(), d.getCiudad(), d.getTelefono(), d.getWhatsapp(),
                d.getEmail(), d.getInstagram(),
                d.getLogoUrl() != null ? "/api/configuracion/gimnasio/logo?v=" + Fotos.version(d.getLogoActualizado()) : null);
    }

    // ---- Logo ----

    /** Guarda el logo (PNG o JPG; queda como PNG de hasta 512 px) y reemplaza el anterior. */
    @Transactional
    public DatosGimnasioDTO guardarLogo(MultipartFile archivo) {
        byte[] png = Fotos.normalizarLogo(archivo);
        DatosGimnasio datos = obtener();
        String anterior = datos.getLogoUrl();
        datos.setLogoUrl(archivoService.guardarContenido(png, "logo", "logo", ".png"));
        datos.setLogoActualizado(LocalDateTime.now());
        repository.save(datos);
        // Recién con el nuevo guardado se borra el archivo del anterior
        if (anterior != null) {
            archivoService.eliminar(anterior);
        }
        return aDTO(datos);
    }

    /** El logo, o vacío si no hay. */
    public Optional<ArchivoService.Archivo> cargarLogo() {
        return Optional.ofNullable(obtener().getLogoUrl()).map(archivoService::cargar);
    }

    @Transactional
    public DatosGimnasioDTO eliminarLogo() {
        DatosGimnasio datos = obtener();
        String ruta = datos.getLogoUrl();
        if (ruta != null) {
            datos.setLogoUrl(null);
            datos.setLogoActualizado(null);
            repository.save(datos);
            archivoService.eliminar(ruta);
        }
        return aDTO(datos);
    }

    private static String texto(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    private static String largoMaximo(String valor, int maximo, String campo) {
        if (valor != null && valor.length() > maximo) {
            throw new IllegalArgumentException(campo + " puede tener hasta " + maximo + " caracteres");
        }
        return valor;
    }

}
