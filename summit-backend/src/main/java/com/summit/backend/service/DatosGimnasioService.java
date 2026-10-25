package com.summit.backend.service;

import com.summit.backend.dto.DatosGimnasioDTO;
import com.summit.backend.model.ConfiguracionAcceso;
import com.summit.backend.model.DatosGimnasio;
import com.summit.backend.model.DiaSemana;
import com.summit.backend.model.HorarioGimnasio;
import com.summit.backend.repository.DatosGimnasioRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Datos del gimnasio (PLAN-APP-SOCIOS.md, A5; reemplaza la pantalla de ejemplo de Ajustes > General).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DatosGimnasioService {

    private static final Long ID = 1L;
    private static final int CAPACIDAD_MAXIMA = 2000;
    private static final int LARGO_MAXIMO_REGLAMENTO = 5000;
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern TELEFONO = Pattern.compile("^[0-9+()\\-\\s]{6,25}$");
    private static final Pattern INSTAGRAM = Pattern.compile("^[A-Za-z0-9._]{1,30}$");

    private final DatosGimnasioRepository repository;
    private final ConfiguracionAccesoService configuracionAccesoService;

    /**
     * Crea los datos por defecto la primera vez: el nombre y un horario típico, para que la app tenga algo que
     * mostrar hasta que el admin cargue los reales.
     */
    @PostConstruct
    public void crearSiNoExisten() {
        if (repository.existsById(ID)) {
            return;
        }
        log.info("Creando los datos del gimnasio por defecto...");
        List<HorarioGimnasio> horarios = new ArrayList<>();
        for (DiaSemana dia : DiaSemana.values()) {
            boolean domingo = dia == DiaSemana.DOMINGO;
            boolean sabado = dia == DiaSemana.SABADO;
            horarios.add(new HorarioGimnasio(dia,
                    domingo ? null : LocalTime.of(sabado ? 9 : 7, 0),
                    domingo ? null : LocalTime.of(sabado ? 20 : 23, 0)));
        }
        repository.save(DatosGimnasio.builder().idDatos(ID).nombre("SUMMIT Fitness").horarios(horarios).build());
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

        datos.setReglamento(largoMaximo(texto(pedido.reglamento()), LARGO_MAXIMO_REGLAMENTO, "El reglamento"));

        Integer capacidad = pedido.capacidad();
        if (capacidad != null && (capacidad < 1 || capacidad > CAPACIDAD_MAXIMA)) {
            throw new IllegalArgumentException("La capacidad tiene que estar entre 1 y " + CAPACIDAD_MAXIMA + " personas");
        }
        datos.setCapacidad(capacidad);

        datos.getHorarios().clear();
        datos.getHorarios().addAll(horarios(pedido.horarios()));
        return aDTO(repository.save(datos));
    }

    // Los 7 días en orden; un día que no vino queda cerrado
    private static List<HorarioGimnasio> horarios(List<DatosGimnasioDTO.Horario> pedido) {
        Map<DiaSemana, DatosGimnasioDTO.Horario> porDia = new EnumMap<>(DiaSemana.class);
        if (pedido != null) {
            for (DatosGimnasioDTO.Horario h : pedido) {
                DiaSemana dia;
                try {
                    dia = DiaSemana.valueOf(String.valueOf(h.dia()).toUpperCase());
                } catch (IllegalArgumentException e) {
                    throw new IllegalArgumentException("Día de la semana inválido: " + h.dia());
                }
                porDia.put(dia, h);
            }
        }
        List<HorarioGimnasio> horarios = new ArrayList<>();
        for (DiaSemana dia : DiaSemana.values()) {
            DatosGimnasioDTO.Horario h = porDia.get(dia);
            if (h == null || h.abre() == null) {
                horarios.add(new HorarioGimnasio(dia, null, null));
                continue;
            }
            if (h.cierra() == null) {
                throw new IllegalArgumentException("Falta la hora de cierre del " + nombreDia(dia));
            }
            // Cerrar a las 00:00 es cerrar a medianoche
            boolean medianoche = h.cierra().equals(LocalTime.MIDNIGHT);
            if (!medianoche && !h.cierra().isAfter(h.abre())) {
                throw new IllegalArgumentException("El " + nombreDia(dia) + " la hora de cierre tiene que ser después de la de apertura");
            }
            horarios.add(new HorarioGimnasio(dia, h.abre(), h.cierra()));
        }
        return horarios;
    }

    private DatosGimnasioDTO aDTO(DatosGimnasio d) {
        ConfiguracionAcceso acceso = configuracionAccesoService.obtenerConfiguracionGlobal();
        List<DatosGimnasioDTO.Horario> horarios = d.getHorarios().stream()
                .map(h -> new DatosGimnasioDTO.Horario(h.getDia().name(), h.getAbre(), h.getCierra()))
                .toList();
        return new DatosGimnasioDTO(d.getNombre(), d.getDireccion(), d.getCiudad(), d.getTelefono(), d.getWhatsapp(),
                d.getEmail(), d.getInstagram(), d.getReglamento(), d.getCapacidad(), horarios,
                acceso.getLatitudGimnasio(), acceso.getLongitudGimnasio());
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

    private static String nombreDia(DiaSemana dia) {
        return switch (dia) {
            case LUNES -> "lunes";
            case MARTES -> "martes";
            case MIERCOLES -> "miércoles";
            case JUEVES -> "jueves";
            case VIERNES -> "viernes";
            case SABADO -> "sábado";
            case DOMINGO -> "domingo";
        };
    }
}
