package com.summit.backend.service;

import com.summit.backend.dto.DatosGimnasioDTO;
import com.summit.backend.model.DatosGimnasio;
import com.summit.backend.model.DiaSemana;
import com.summit.backend.model.HorarioGimnasio;
import com.summit.backend.repository.DatosGimnasioRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Datos del gimnasio (Ajustes > Datos del gimnasio): nombre, contacto y logo, que salen en los PDF, y el horario de
 * cada día, que usan las métricas.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DatosGimnasioService {

    private static final Long ID = 1L;
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern TELEFONO = Pattern.compile("^[0-9+()\\-\\s]{6,25}$");
    private static final Pattern INSTAGRAM = Pattern.compile("^[A-Za-z0-9._]{1,30}$");

    private final DatosGimnasioRepository repository;
    private final ArchivoService archivoService;

    /**
     * Crea los datos por defecto la primera vez (el nombre y el horario), hasta que el admin cargue los reales. Una base
     * de antes del horario lo recibe también.
     */
    @PostConstruct
    public void crearSiNoExisten() {
        DatosGimnasio datos = repository.findById(ID).orElse(null);
        if (datos == null) {
            log.info("Creando los datos del gimnasio por defecto...");
            repository.save(DatosGimnasio.builder().idDatos(ID).nombre("SUMMIT Fitness").horarios(horarioPorDefecto()).build());
        } else if (datos.getHorarios().size() != DiaSemana.values().length) {
            log.info("Cargando el horario del gimnasio por defecto...");
            datos.getHorarios().clear();
            datos.getHorarios().addAll(horarioPorDefecto());
            repository.save(datos);
        }
    }

    // De lunes a viernes de 8 a 22, los sábados de 8 a 13 y los domingos cerrado
    private static List<HorarioGimnasio> horarioPorDefecto() {
        List<HorarioGimnasio> horarios = new ArrayList<>();
        for (DiaSemana dia : DiaSemana.values()) {
            horarios.add(switch (dia) {
                case SABADO -> new HorarioGimnasio(dia, LocalTime.of(8, 0), LocalTime.of(13, 0));
                case DOMINGO -> new HorarioGimnasio(dia, null, null);
                default -> new HorarioGimnasio(dia, LocalTime.of(8, 0), LocalTime.of(22, 0));
            });
        }
        return horarios;
    }

    public DatosGimnasio obtener() {
        return repository.findById(ID).orElseThrow(() -> new IllegalStateException("Faltan los datos del gimnasio"));
    }

    /** El horario de cada día de la semana (los que no abren tienen abre y cierra en null). */
    @Transactional(readOnly = true)
    public Map<DayOfWeek, HorarioGimnasio> horarioSemanal() {
        Map<DayOfWeek, HorarioGimnasio> semana = new EnumMap<>(DayOfWeek.class);
        for (HorarioGimnasio horario : obtener().getHorarios()) {
            semana.put(DayOfWeek.of(horario.getDia().ordinal() + 1), horario);
        }
        return semana;
    }

    /** Los días de la semana en que el gimnasio no abre. */
    public Set<DayOfWeek> diasCerrados() {
        Set<DayOfWeek> cerrados = EnumSet.noneOf(DayOfWeek.class);
        horarioSemanal().forEach((dia, horario) -> {
            if (!horario.abierto()) {
                cerrados.add(dia);
            }
        });
        return cerrados;
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
        if (pedido.horarios() != null) {
            List<HorarioGimnasio> horarios = horarios(pedido.horarios());
            datos.getHorarios().clear();
            datos.getHorarios().addAll(horarios);
        }
        return aDTO(repository.save(datos));
    }

    // Los 7 días, cada uno abierto (abre antes de cerrar) o cerrado (sin horas)
    private static List<HorarioGimnasio> horarios(List<DatosGimnasioDTO.Horario> pedido) {
        Map<DiaSemana, HorarioGimnasio> porDia = new EnumMap<>(DiaSemana.class);
        for (DatosGimnasioDTO.Horario h : pedido) {
            DiaSemana dia;
            try {
                dia = DiaSemana.valueOf(h.dia());
            } catch (IllegalArgumentException | NullPointerException e) {
                throw new IllegalArgumentException("Día de la semana desconocido: " + h.dia());
            }
            LocalTime abre = hora(h.abre());
            LocalTime cierra = hora(h.cierra());
            if ((abre == null) != (cierra == null)) {
                throw new IllegalArgumentException("Completá a qué hora abre y a qué hora cierra el " + nombre(dia)
                        + " (o marcalo como cerrado)");
            }
            if (abre != null && !abre.isBefore(cierra)) {
                throw new IllegalArgumentException("El " + nombre(dia) + " tiene que abrir antes de cerrar");
            }
            porDia.put(dia, new HorarioGimnasio(dia, abre, cierra));
        }
        if (porDia.size() != DiaSemana.values().length) {
            throw new IllegalArgumentException("Falta el horario de algún día de la semana");
        }
        if (porDia.values().stream().noneMatch(HorarioGimnasio::abierto)) {
            throw new IllegalArgumentException("El gimnasio tiene que abrir al menos un día de la semana");
        }
        return new ArrayList<>(porDia.values());
    }

    private static LocalTime hora(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        try {
            return LocalTime.parse(texto.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("La hora " + texto + " no es válida (usá el formato 08:30)");
        }
    }

    private static String nombre(DiaSemana dia) {
        return dia == DiaSemana.MIERCOLES ? "miércoles" : dia == DiaSemana.SABADO ? "sábado" : dia.name().toLowerCase();
    }

    private static DatosGimnasioDTO aDTO(DatosGimnasio d) {
        List<DatosGimnasioDTO.Horario> horarios = d.getHorarios().stream()
                .map(h -> new DatosGimnasioDTO.Horario(h.getDia().name(),
                        h.getAbre() != null ? h.getAbre().format(HH_MM) : null,
                        h.getCierra() != null ? h.getCierra().format(HH_MM) : null))
                .toList();
        return new DatosGimnasioDTO(d.getNombre(), d.getDireccion(), d.getCiudad(), d.getTelefono(), d.getWhatsapp(),
                d.getEmail(), d.getInstagram(),
                d.getLogoUrl() != null ? "/api/configuracion/gimnasio/logo?v=" + Fotos.version(d.getLogoActualizado()) : null,
                horarios);
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
