package com.summit.backend.service;

import com.summit.backend.dto.CongelamientoDTO;
import com.summit.backend.dto.CongelamientoRequestDTO;
import com.summit.backend.model.Congelamiento;
import com.summit.backend.model.EstadoDebito;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.ReglasMembresia;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Suscripcion;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.CongelamientoRepository;
import com.summit.backend.repository.DebitoAutomaticoRepository;
import com.summit.backend.repository.SuscripcionRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

import static com.summit.backend.service.AsistenciaService.textoDias;

/**
 * Congelamiento de membresías: mientras dura, el socio no puede ingresar y el vencimiento de su membresía se corre
 * esos días. Los límites (mínimo de días y máximo por año) son las reglas de membresía.
 */
@Service
@RequiredArgsConstructor
public class CongelamientoService {

    private final CongelamientoRepository congelamientoRepository;
    private final UsuarioRepository usuarioRepository;
    private final SuscripcionRepository suscripcionRepository;
    private final DebitoAutomaticoRepository debitoAutomaticoRepository;
    private final ReglasMembresiaService reglasService;

    /** Congelamientos de un socio, del más nuevo al más viejo. */
    @Transactional(readOnly = true)
    public List<CongelamientoDTO> historial(Long idSocio) {
        LocalDate hoy = LocalDate.now();
        return congelamientoRepository.findByUsuarioIdUsuarioOrderByDesdeDescIdCongelamientoDesc(idSocio).stream()
                .map(c -> aDto(c, hoy))
                .toList();
    }

    /** El congelamiento que rige en una fecha (no se superponen). */
    public Optional<Congelamiento> vigente(Long idUsuario, LocalDate fecha) {
        return congelamientoRepository.vigenteEl(idUsuario, fecha);
    }

    /** Socios con la membresía congelada hoy: idUsuario → último día congelado. */
    public Map<Long, LocalDate> congeladosHoy() {
        Map<Long, LocalDate> congelados = new HashMap<>();
        for (Object[] fila : congelamientoRepository.vigentesEl(LocalDate.now())) {
            congelados.put((Long) fila[0], (LocalDate) fila[1]);
        }
        return congelados;
    }

    /**
     * Congela la membresía de un socio del día "desde" al "hasta" (los dos incluidos) y le corre el vencimiento esos
     * días. Tiene que empezar hoy o más adelante, con la membresía vigente ese día, sin superponerse con otro y dentro
     * de los límites de las reglas de membresía (el máximo por año también limita cada congelamiento).
     * La membresía se bloquea antes de validar: dos pedidos a la vez (un doble clic) no pasan los dos los controles.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public CongelamientoDTO registrar(Long idSocio, CongelamientoRequestDTO pedido, String emailRegistrador) {
        // Lo primero es bloquear la membresía: un pedido igual al mismo tiempo espera acá a que este termine y después,
        // con READ_COMMITTED, sus controles ven el congelamiento que guardó este (con el aislamiento por defecto
        // seguiría viendo la base como estaba al empezar)
        Optional<Suscripcion> activa = suscripcionRepository.activasParaActualizar(idSocio).stream().findFirst();
        Usuario socio = socio(idSocio);
        if (socio.getEstado() != EstadoUsuario.ACTIVO) {
            throw new IllegalStateException("La cuenta del socio no está activa");
        }
        ReglasMembresia reglas = reglasService.obtener();
        int maximoAnual = reglas.getCongelamientoMaxDiasAnio();
        if (maximoAnual == 0) {
            throw new IllegalStateException("El gimnasio no congela membresías: se habilita en Membresías > Descuentos y reglas");
        }

        LocalDate hoy = LocalDate.now();
        LocalDate desde = pedido.getDesde();
        LocalDate hasta = pedido.getHasta();
        if (desde.isBefore(hoy)) {
            throw new IllegalArgumentException("El congelamiento tiene que empezar hoy o más adelante");
        }
        if (hasta.isBefore(desde)) {
            throw new IllegalArgumentException("El último día no puede ser anterior al primero");
        }
        long dias = ChronoUnit.DAYS.between(desde, hasta) + 1;
        if (dias < reglas.getCongelamientoMinDias()) {
            throw new IllegalArgumentException("El congelamiento mínimo es de " + textoDias(reglas.getCongelamientoMinDias()));
        }

        Suscripcion suscripcion = activa
                .orElseThrow(() -> new IllegalStateException("El socio no tiene una membresía para congelar"));
        if (suscripcion.getFechaVencimiento().isBefore(desde)) {
            throw new IllegalStateException("La membresía vence el " + TextoFechas.completa(suscripcion.getFechaVencimiento())
                    + ", antes de que empiece el congelamiento: primero tiene que renovarla");
        }
        if (congelamientoRepository.seSuperpone(idSocio, desde, hasta)) {
            throw new IllegalStateException("Ya tiene un congelamiento en esas fechas");
        }
        long usados = congelamientoRepository.diasUsadosEntre(idSocio, desde.with(TemporalAdjusters.firstDayOfYear()),
                desde.with(TemporalAdjusters.lastDayOfYear()));
        if (usados + dias > maximoAnual) {
            long quedan = Math.max(0, maximoAnual - usados);
            throw new IllegalStateException("Supera el máximo de " + maximoAnual + " días congelados por año: en "
                    + desde.getYear() + " ya usó " + usados
                    + (quedan > 0 ? " y le quedan " + textoDias(quedan) : " y no le quedan días"));
        }

        suscripcion.setFechaVencimiento(suscripcion.getFechaVencimiento().plusDays(dias));
        suscripcionRepository.save(suscripcion);
        Congelamiento congelamiento = congelamientoRepository.save(Congelamiento.builder()
                .usuario(socio)
                .suscripcion(suscripcion)
                .desde(desde)
                .hasta(hasta)
                .motivo(pedido.getMotivo())
                .observacion(pedido.getObservacion() == null || pedido.getObservacion().isBlank()
                        ? null : pedido.getObservacion().trim())
                .diasAplicados((int) dias)
                .registradoPor(usuarioRepository.findByEmail(emailRegistrador).orElse(null))
                .build());

        CongelamientoDTO dto = aDto(congelamiento, hoy);
        dto.setVencimientoMembresia(suscripcion.getFechaVencimiento());
        if (debitoAutomaticoRepository.findFirstByUsuarioIdUsuarioAndEstadoInOrderByFechaAltaDesc(idSocio,
                List.of(EstadoDebito.ACTIVO)).isPresent()) {
            dto.setAviso("Tiene débito automático: Mercado Pago le va a seguir cobrando cada mes mientras esté congelada "
                    + "(cada cobro igual le suma su mes a la membresía)");
        }
        return dto;
    }

    /**
     * El socio volvió antes: el congelamiento termina ayer y se le descuentan del vencimiento los días que no usó. Si
     * todavía no había empezado (o empezaba hoy), se anula entero y se le descuentan todos.
     */
    @Transactional
    public CongelamientoDTO terminar(Long idSocio, Long idCongelamiento) {
        Congelamiento congelamiento = congelamientoRepository.findParaActualizar(idCongelamiento, idSocio)
                .orElseThrow(() -> new NoSuchElementException("No existe ese congelamiento"));
        LocalDate hoy = LocalDate.now();
        if (congelamiento.isAnulado()) {
            throw new IllegalStateException("Ese congelamiento ya estaba anulado");
        }
        if (congelamiento.getHasta().isBefore(hoy)) {
            throw new IllegalStateException("Ese congelamiento ya terminó");
        }

        int devueltos;
        if (!congelamiento.getDesde().isBefore(hoy)) {
            devueltos = congelamiento.getDiasAplicados();
            congelamiento.setAnulado(true);
            congelamiento.setDiasAplicados(0);
        } else {
            LocalDate ayer = hoy.minusDays(1);
            devueltos = (int) ChronoUnit.DAYS.between(ayer, congelamiento.getHasta());
            congelamiento.setHasta(ayer);
            congelamiento.setDiasAplicados(congelamiento.getDiasAplicados() - devueltos);
            congelamiento.setTerminadoAntes(true);
        }
        Suscripcion suscripcion = suscripcionRepository
                .findParaActualizar(congelamiento.getSuscripcion().getIdSuscripcion())
                .orElseThrow(() -> new IllegalStateException("No se encontró la membresía del congelamiento"));
        suscripcion.setFechaVencimiento(suscripcion.getFechaVencimiento().minusDays(devueltos));
        suscripcionRepository.save(suscripcion);

        CongelamientoDTO dto = aDto(congelamientoRepository.save(congelamiento), hoy);
        dto.setVencimientoMembresia(suscripcion.getFechaVencimiento());
        return dto;
    }

    private Usuario socio(Long idSocio) {
        return usuarioRepository.findById(idSocio)
                .filter(u -> u.getRol() == Rol.SOCIO)
                .orElseThrow(() -> new NoSuchElementException("Socio no encontrado"));
    }

    private static String estado(Congelamiento c, LocalDate hoy) {
        if (c.isAnulado()) return "ANULADO";
        if (c.getDesde().isAfter(hoy)) return "PROGRAMADO";
        if (c.getHasta().isBefore(hoy)) return "TERMINADO";
        return "EN_CURSO";
    }

    private static CongelamientoDTO aDto(Congelamiento c, LocalDate hoy) {
        return CongelamientoDTO.builder()
                .idCongelamiento(c.getIdCongelamiento())
                .desde(c.getDesde())
                .hasta(c.getHasta())
                .dias(c.getDiasAplicados())
                .motivo(c.getMotivo().name())
                .observacion(c.getObservacion())
                .estado(estado(c, hoy))
                .terminadoAntes(c.isTerminadoAntes())
                .registradoPor(c.getRegistradoPor() != null ? c.getRegistradoPor().getNombreCompleto() : null)
                .fechaRegistro(c.getFechaRegistro())
                .build();
    }
}
