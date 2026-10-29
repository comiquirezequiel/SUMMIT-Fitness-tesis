package com.summit.backend.service;

import com.summit.backend.dto.CierreCajaDTO;
import com.summit.backend.dto.CierreRequestDTO;
import com.summit.backend.dto.GastoDTO;
import com.summit.backend.dto.GastoRequestDTO;
import com.summit.backend.dto.TurnoCajaDTO;
import com.summit.backend.model.CierreCaja;
import com.summit.backend.model.Gasto;
import com.summit.backend.model.MetodoPago;
import com.summit.backend.model.TotalMetodoCierre;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.CierreCajaRepository;
import com.summit.backend.repository.GastoRepository;
import com.summit.backend.repository.PagoHistorialRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

import static com.summit.backend.service.TextoMontos.pesos;

/**
 * Caja de recepción: gastos (egresos), el turno abierto y su cierre (arqueo).
 *
 * <p>Un turno va desde el cierre anterior (o desde el comienzo del día, si nunca se cerró) hasta ahora. Al cerrarlo,
 * recepción cuenta el efectivo de la caja y se compara con el esperado: el fondo que dejó el cierre anterior, más los
 * cobros aprobados en efectivo, menos los gastos pagados en efectivo. Lo que no se retira queda de fondo para el turno
 * siguiente. Los demás medios de pago se informan para conciliarlos con el banco o Mercado Pago.</p>
 *
 * <p>Un gasto en efectivo no puede superar el efectivo que hay en la caja: el esperado nunca queda negativo (ningún
 * conteo podría coincidir). Si lo pagó el dueño con su plata, se marca "fuera de caja" y no entra en el arqueo.</p>
 */
@Service
@RequiredArgsConstructor
public class CajaService {

    private static final BigDecimal MONTO_MAXIMO = new BigDecimal("100000000");

    private final GastoRepository gastoRepository;
    private final CierreCajaRepository cierreCajaRepository;
    private final PagoHistorialRepository pagoHistorialRepository;
    private final UsuarioRepository usuarioRepository;

    // ---- Turno y cierre ----

    /** Lo que se mueve en un turno, por medio de pago. */
    private record Turno(LocalDateTime desde, LocalDateTime hasta, BigDecimal fondoInicial,
                         Map<MetodoPago, BigDecimal> ingresos, Map<MetodoPago, BigDecimal> egresos,
                         int cobros, int gastos, CierreCaja anterior) {

        BigDecimal ingresosEfectivo() {
            return ingresos.getOrDefault(MetodoPago.EFECTIVO, BigDecimal.ZERO);
        }

        BigDecimal egresosEfectivo() {
            return egresos.getOrDefault(MetodoPago.EFECTIVO, BigDecimal.ZERO);
        }

        BigDecimal efectivoEsperado() {
            return fondoInicial.add(ingresosEfectivo()).subtract(egresosEfectivo());
        }

        BigDecimal totalIngresos() {
            return ingresos.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        BigDecimal totalEgresos() {
            return egresos.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        // Solo los medios con movimientos, en el orden de MetodoPago
        List<TurnoCajaDTO.TotalMetodo> metodos() {
            List<TurnoCajaDTO.TotalMetodo> metodos = new ArrayList<>();
            for (MetodoPago metodo : MetodoPago.values()) {
                if (ingresos.containsKey(metodo) || egresos.containsKey(metodo)) {
                    metodos.add(new TurnoCajaDTO.TotalMetodo(metodo.name(),
                            ingresos.getOrDefault(metodo, BigDecimal.ZERO), egresos.getOrDefault(metodo, BigDecimal.ZERO)));
                }
            }
            return metodos;
        }
    }

    /** El turno abierto: desde el último cierre hasta ahora. */
    @Transactional(readOnly = true)
    public TurnoCajaDTO turnoActual() {
        Turno turno = calcularTurno(ahora());
        return TurnoCajaDTO.builder()
                .desde(turno.desde())
                .fondoInicial(turno.fondoInicial())
                .metodos(turno.metodos())
                .totalIngresos(turno.totalIngresos())
                .totalEgresos(turno.totalEgresos())
                .ingresosEfectivo(turno.ingresosEfectivo())
                .egresosEfectivo(turno.egresosEfectivo())
                .efectivoEsperado(turno.efectivoEsperado())
                .cantidadCobros(turno.cobros())
                .cantidadGastos(turno.gastos())
                .ultimoCierre(turno.anterior() != null ? turno.anterior().getHasta() : null)
                .ultimoCierrePor(turno.anterior() != null && turno.anterior().getCerradoPor() != null
                        ? turno.anterior().getCerradoPor().getNombreCompleto() : null)
                .build();
    }

    /**
     * Cierra el turno abierto con el efectivo que se contó. Si no coincide con el esperado, la observación es
     * obligatoria (queda registrado el faltante o sobrante y por qué).
     *
     * @throws IllegalStateException si otra persona cerró la caja al mismo tiempo
     */
    @Transactional
    public CierreCajaDTO cerrar(CierreRequestDTO pedido, String emailCajero) {
        BigDecimal contado = montoValido(pedido.efectivoContado(), "El efectivo contado", true);
        BigDecimal retiro = pedido.retiro() == null ? BigDecimal.ZERO : montoValido(pedido.retiro(), "El retiro", true);
        if (retiro.compareTo(contado) > 0) {
            throw new IllegalArgumentException("No se puede retirar más efectivo del que hay en la caja (" + pesos(contado) + ")");
        }
        String observacion = pedido.observacion() == null || pedido.observacion().isBlank()
                ? null : pedido.observacion().trim();

        Turno turno = calcularTurno(ahora());
        BigDecimal diferencia = contado.subtract(turno.efectivoEsperado());
        if (diferencia.signum() != 0 && (observacion == null || observacion.length() < 5)) {
            throw new IllegalArgumentException("Hay " + (diferencia.signum() < 0 ? "un faltante" : "un sobrante") + " de "
                    + pesos(diferencia.abs()) + ": explicá el motivo en la observación (queda registrada)");
        }

        List<TotalMetodoCierre> metodos = turno.metodos().stream()
                .map(m -> new TotalMetodoCierre(MetodoPago.valueOf(m.metodoPago()), m.ingresos(), m.egresos()))
                .toList();
        CierreCaja cierre = CierreCaja.builder()
                .desde(turno.desde())
                .hasta(turno.hasta())
                .fondoInicial(turno.fondoInicial())
                .ingresosEfectivo(turno.ingresosEfectivo())
                .egresosEfectivo(turno.egresosEfectivo())
                .efectivoEsperado(turno.efectivoEsperado())
                .efectivoContado(contado)
                .diferencia(diferencia)
                .retiro(retiro)
                .fondoSiguiente(contado.subtract(retiro))
                .totalIngresos(turno.totalIngresos())
                .totalEgresos(turno.totalEgresos())
                .cantidadCobros(turno.cobros())
                .cantidadGastos(turno.gastos())
                .observacion(observacion)
                .cerradoPor(usuarioPorEmail(emailCajero))
                .metodos(new ArrayList<>(metodos))
                .build();
        try {
            return aDto(cierreCajaRepository.saveAndFlush(cierre));
        } catch (DataIntegrityViolationException e) {
            // Mismo "desde" que un cierre recién guardado: dos personas cerraron el mismo turno
            throw new IllegalStateException("Otra persona acaba de cerrar la caja: actualizá para ver el turno nuevo");
        }
    }

    @Transactional(readOnly = true)
    public Page<CierreCajaDTO> listarCierres(Pageable pageable) {
        return cierreCajaRepository.findAll(pageable).map(this::aDto);
    }

    // El fin del turno (sin incluir) con la precisión que guarda la base (microsegundos), un microsegundo después de
    // ahora: entra también lo registrado en este mismo microsegundo. Es exactamente el comienzo del turno siguiente, así
    // ningún cobro queda en dos turnos ni en ninguno (cobros y gastos se guardan con esa misma precisión)
    private static LocalDateTime ahora() {
        return LocalDateTime.now().truncatedTo(ChronoUnit.MICROS).plus(1, ChronoUnit.MICROS);
    }

    private Turno calcularTurno(LocalDateTime hasta) {
        CierreCaja anterior = cierreCajaRepository.findFirstByOrderByHastaDesc().orElse(null);
        LocalDateTime desde = anterior != null ? anterior.getHasta() : hasta.toLocalDate().atStartOfDay();
        BigDecimal fondoInicial = anterior != null ? anterior.getFondoSiguiente() : BigDecimal.ZERO;

        Map<MetodoPago, BigDecimal> ingresos = new EnumMap<>(MetodoPago.class);
        int cobros = 0;
        for (Object[] fila : pagoHistorialRepository.aprobadosPorMetodoEntre(desde, hasta)) {
            ingresos.put((MetodoPago) fila[0], (BigDecimal) fila[1]);
            cobros += ((Long) fila[2]).intValue();
        }
        Map<MetodoPago, BigDecimal> egresos = new EnumMap<>(MetodoPago.class);
        int gastos = 0;
        for (Object[] fila : gastoRepository.sumarPorMetodoEntre(desde, hasta)) {
            egresos.put((MetodoPago) fila[0], (BigDecimal) fila[1]);
            gastos += ((Long) fila[2]).intValue();
        }
        return new Turno(desde, hasta, fondoInicial, ingresos, egresos, cobros, gastos, anterior);
    }

    // ---- Gastos ----

    @Transactional
    public GastoDTO registrarGasto(GastoRequestDTO pedido, String emailCajero) {
        if (pedido.metodoPago() == MetodoPago.DEBITO_AUTOMATICO) {
            throw new IllegalArgumentException("Elegí cómo se pagó el gasto: efectivo, transferencia, tarjeta o Mercado Pago");
        }
        BigDecimal monto = montoValido(pedido.monto(), "El monto", false);
        // Los demás medios nunca tocan la caja: "fuera de caja" solo tiene sentido en efectivo
        boolean efectivo = pedido.metodoPago() == MetodoPago.EFECTIVO;
        boolean fueraDeCaja = efectivo && pedido.fueraDeCaja();
        if (efectivo && !fueraDeCaja) {
            BigDecimal enCaja = calcularTurno(ahora()).efectivoEsperado().max(BigDecimal.ZERO);
            if (monto.compareTo(enCaja) > 0) {
                throw new IllegalArgumentException("En la caja hay " + pesos(enCaja) + " en efectivo: no alcanza para pagar "
                        + pesos(monto) + ". Si lo pagó el dueño con su plata, marcá que no salió de la caja; si se pagó de otra forma, elegí cómo");
            }
        }
        String comprobante = pedido.comprobante() == null || pedido.comprobante().isBlank()
                ? null : pedido.comprobante().trim();
        Gasto gasto = gastoRepository.save(Gasto.builder()
                .monto(monto)
                .categoria(pedido.categoria())
                .descripcion(pedido.descripcion().trim())
                .metodoPago(pedido.metodoPago())
                .fueraDeCaja(fueraDeCaja)
                .comprobanteNro(comprobante)
                .registradoPor(usuarioPorEmail(emailCajero))
                .build());
        return aDto(gasto, inicioTurnoAbierto());
    }

    @Transactional(readOnly = true)
    public Page<GastoDTO> listarGastos(Pageable pageable) {
        LocalDateTime inicioTurno = inicioTurnoAbierto();
        return gastoRepository.findAll(pageable).map(g -> aDto(g, inicioTurno));
    }

    /**
     * Anula un gasto cargado por error (queda en el listado, tachado, con quién lo anuló y por qué). Solo los del turno
     * abierto: uno que ya entró en un cierre de caja cambiaría un arqueo que ya se hizo.
     */
    @Transactional
    public GastoDTO anularGasto(Long idGasto, String motivo, String emailCajero) {
        Gasto gasto = gastoRepository.findById(idGasto)
                .orElseThrow(() -> new NoSuchElementException("No existe el gasto " + idGasto));
        if (gasto.isAnulado()) {
            throw new IllegalStateException("Ese gasto ya estaba anulado");
        }
        LocalDateTime inicioTurno = inicioTurnoAbierto();
        if (inicioTurno != null && gasto.getFecha().isBefore(inicioTurno)) {
            throw new IllegalStateException("Ese gasto ya entró en un cierre de caja: no se puede anular");
        }
        String motivoLimpio = motivo == null ? "" : motivo.trim();
        if (motivoLimpio.length() < 5 || motivoLimpio.length() > 200) {
            throw new IllegalArgumentException("Escribí por qué se anula (entre 5 y 200 caracteres)");
        }
        gasto.setAnulado(true);
        gasto.setAnuladoPor(usuarioPorEmail(emailCajero));
        gasto.setFechaAnulacion(LocalDateTime.now());
        gasto.setMotivoAnulacion(motivoLimpio);
        return aDto(gastoRepository.save(gasto), inicioTurno);
    }

    // ---- Comunes ----

    // Cuándo empezó el turno abierto (el último cierre); null si nunca se cerró la caja
    private LocalDateTime inicioTurnoAbierto() {
        return cierreCajaRepository.findFirstByOrderByHastaDesc().map(CierreCaja::getHasta).orElse(null);
    }

    private static BigDecimal montoValido(BigDecimal monto, String nombre, boolean ceroPermitido) {
        if (monto == null) {
            throw new IllegalArgumentException(nombre + " es obligatorio");
        }
        if (monto.signum() < 0 || (!ceroPermitido && monto.signum() == 0)) {
            throw new IllegalArgumentException(nombre + (ceroPermitido ? " no puede ser negativo" : " tiene que ser mayor a cero"));
        }
        if (monto.compareTo(MONTO_MAXIMO) >= 0 || monto.stripTrailingZeros().scale() > 2) {
            throw new IllegalArgumentException(nombre + " no es un monto válido");
        }
        return monto.setScale(2, RoundingMode.HALF_UP);
    }

    private Usuario usuarioPorEmail(String email) {
        return email == null ? null : usuarioRepository.findByEmail(email).orElse(null);
    }

    private static GastoDTO aDto(Gasto g, LocalDateTime inicioTurno) {
        return GastoDTO.builder()
                .idGasto(g.getIdGasto())
                .fecha(g.getFecha())
                .monto(g.getMonto())
                .categoria(g.getCategoria().name())
                .descripcion(g.getDescripcion())
                .metodoPago(g.getMetodoPago().name())
                .fueraDeCaja(g.isFueraDeCaja())
                .comprobante(g.getComprobanteNro())
                .registradoPor(g.getRegistradoPor() != null ? g.getRegistradoPor().getNombreCompleto() : null)
                .anulado(g.isAnulado())
                .anuladoPor(g.getAnuladoPor() != null ? g.getAnuladoPor().getNombreCompleto() : null)
                .fechaAnulacion(g.getFechaAnulacion())
                .motivoAnulacion(g.getMotivoAnulacion())
                .anulable(!g.isAnulado() && (inicioTurno == null || !g.getFecha().isBefore(inicioTurno)))
                .build();
    }

    private CierreCajaDTO aDto(CierreCaja c) {
        return CierreCajaDTO.builder()
                .idCierre(c.getIdCierre())
                .desde(c.getDesde())
                .hasta(c.getHasta())
                .fondoInicial(c.getFondoInicial())
                .ingresosEfectivo(c.getIngresosEfectivo())
                .egresosEfectivo(c.getEgresosEfectivo())
                .efectivoEsperado(c.getEfectivoEsperado())
                .efectivoContado(c.getEfectivoContado())
                .diferencia(c.getDiferencia())
                .retiro(c.getRetiro())
                .fondoSiguiente(c.getFondoSiguiente())
                .totalIngresos(c.getTotalIngresos())
                .totalEgresos(c.getTotalEgresos())
                .cantidadCobros(c.getCantidadCobros())
                .cantidadGastos(c.getCantidadGastos())
                .observacion(c.getObservacion())
                .cerradoPor(c.getCerradoPor() != null ? c.getCerradoPor().getNombreCompleto() : null)
                .metodos(c.getMetodos().stream()
                        .map(m -> new TurnoCajaDTO.TotalMetodo(m.getMetodoPago().name(), m.getIngresos(), m.getEgresos()))
                        .toList())
                .build();
    }
}
