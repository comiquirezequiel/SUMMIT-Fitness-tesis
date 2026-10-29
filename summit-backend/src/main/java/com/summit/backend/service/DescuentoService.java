package com.summit.backend.service;

import com.summit.backend.dto.DescuentoDTO;
import com.summit.backend.dto.DescuentoRequestDTO;
import com.summit.backend.model.Descuento;
import com.summit.backend.model.TipoDescuento;
import com.summit.backend.repository.DescuentoRepository;
import com.summit.backend.repository.PerfilSocioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Catálogo de descuentos que arma el dueño (porcentaje o monto fijo sobre el precio del plan).
 */
@Service
@RequiredArgsConstructor
public class DescuentoService {

    private static final BigDecimal CIEN = new BigDecimal("100");
    private static final BigDecimal VALOR_MAXIMO = new BigDecimal("10000000");

    private final DescuentoRepository descuentoRepository;
    private final PerfilSocioRepository perfilSocioRepository;

    /** El catálogo (soloActivos: los que se ofrecen al cobrar), con cuántos socios tienen cada uno como habitual. */
    @Transactional(readOnly = true)
    public List<DescuentoDTO> listar(boolean soloActivos) {
        Map<Long, Long> socios = sociosPorDescuento();
        List<Descuento> descuentos = soloActivos
                ? descuentoRepository.findByActivoTrueOrderByNombreAsc()
                : descuentoRepository.findAllByOrderByActivoDescNombreAsc();
        return descuentos.stream()
                .map(d -> aDto(d, socios.getOrDefault(d.getIdDescuento(), 0L)))
                .toList();
    }

    @Transactional
    public DescuentoDTO crear(DescuentoRequestDTO pedido) {
        String nombre = pedido.nombre().trim();
        if (descuentoRepository.existsByNombreIgnoreCase(nombre)) {
            throw new IllegalArgumentException("Ya hay un descuento llamado \"" + nombre + "\"");
        }
        validarValor(pedido.tipo(), pedido.valor());
        Descuento descuento = descuentoRepository.save(Descuento.builder()
                .nombre(nombre)
                .tipo(pedido.tipo())
                .valor(pedido.valor().setScale(2, RoundingMode.HALF_UP))
                .activo(pedido.activo() == null || pedido.activo())
                .build());
        return aDto(descuento, 0);
    }

    /**
     * Modifica un descuento. Los cobros ya hechos no cambian: guardan el nombre y el monto que se descontó.
     */
    @Transactional
    public DescuentoDTO actualizar(Long idDescuento, DescuentoRequestDTO pedido) {
        Descuento descuento = buscar(idDescuento);
        String nombre = pedido.nombre().trim();
        if (descuentoRepository.existsByNombreIgnoreCaseAndIdDescuentoNot(nombre, idDescuento)) {
            throw new IllegalArgumentException("Ya hay otro descuento llamado \"" + nombre + "\"");
        }
        validarValor(pedido.tipo(), pedido.valor());
        descuento.setNombre(nombre);
        descuento.setTipo(pedido.tipo());
        descuento.setValor(pedido.valor().setScale(2, RoundingMode.HALF_UP));
        if (pedido.activo() != null) {
            descuento.setActivo(pedido.activo());
        }
        descuento = descuentoRepository.save(descuento);
        return aDto(descuento, perfilSocioRepository.countByDescuentoIdDescuento(idDescuento));
    }

    /** Borra un descuento: los socios que lo tenían como habitual se quedan sin descuento. */
    @Transactional
    public void eliminar(Long idDescuento) {
        Descuento descuento = buscar(idDescuento);
        perfilSocioRepository.quitarDescuento(descuento);
        descuentoRepository.delete(descuento);
    }

    public Descuento buscar(Long idDescuento) {
        return descuentoRepository.findById(idDescuento)
                .orElseThrow(() -> new NoSuchElementException("No existe el descuento " + idDescuento));
    }

    /** Un descuento que se puede aplicar o asignar: tiene que estar activo. */
    public Descuento activo(Long idDescuento) {
        Descuento descuento = buscar(idDescuento);
        if (!descuento.isActivo()) {
            throw new IllegalArgumentException("El descuento \"" + descuento.getNombre() + "\" está desactivado");
        }
        return descuento;
    }

    /** Pesos que descuenta sobre un precio (redondeado al centavo y nunca más que el precio). */
    public static BigDecimal montoSobre(Descuento descuento, BigDecimal precio) {
        BigDecimal monto = descuento.getTipo() == TipoDescuento.PORCENTAJE
                ? precio.multiply(descuento.getValor()).divide(CIEN, 2, RoundingMode.HALF_UP)
                : descuento.getValor();
        return monto.min(precio).setScale(2, RoundingMode.HALF_UP);
    }

    private static void validarValor(TipoDescuento tipo, BigDecimal valor) {
        if (valor.signum() <= 0) {
            throw new IllegalArgumentException("El valor del descuento tiene que ser mayor a cero");
        }
        if (tipo == TipoDescuento.PORCENTAJE && valor.compareTo(CIEN) > 0) {
            throw new IllegalArgumentException("Un porcentaje no puede superar el 100 %");
        }
        if (valor.compareTo(VALOR_MAXIMO) >= 0) {
            throw new IllegalArgumentException("El valor del descuento no es válido");
        }
        if (valor.stripTrailingZeros().scale() > 2) {
            throw new IllegalArgumentException("El valor del descuento puede tener como mucho 2 decimales");
        }
    }

    private Map<Long, Long> sociosPorDescuento() {
        Map<Long, Long> socios = new HashMap<>();
        for (Object[] fila : perfilSocioRepository.sociosPorDescuento()) {
            socios.put((Long) fila[0], (Long) fila[1]);
        }
        return socios;
    }

    private static DescuentoDTO aDto(Descuento d, long socios) {
        return DescuentoDTO.builder()
                .idDescuento(d.getIdDescuento())
                .nombre(d.getNombre())
                .tipo(d.getTipo().name())
                .valor(d.getValor())
                .activo(d.isActivo())
                .socios(socios)
                .build();
    }
}
