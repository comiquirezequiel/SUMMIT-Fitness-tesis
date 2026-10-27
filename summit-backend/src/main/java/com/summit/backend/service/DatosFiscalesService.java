package com.summit.backend.service;

import com.summit.backend.dto.DatosFiscalesDTO;
import com.summit.backend.model.CondicionIva;
import com.summit.backend.model.DatosFiscales;
import com.summit.backend.repository.DatosFiscalesRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Datos fiscales del dueño del gimnasio (fila única): sin todos completos no sale ninguna factura.
 */
@Service
@RequiredArgsConstructor
public class DatosFiscalesService {

    private static final long ID = 1L;
    private static final int[] PESOS_CUIT = {5, 4, 3, 2, 7, 6, 5, 4, 3, 2};

    private final DatosFiscalesRepository repository;

    /** Los guardados, o unos vacíos si todavía no se cargaron. */
    public DatosFiscales obtener() {
        return repository.findById(ID).orElseGet(() -> DatosFiscales.builder().idDatos(ID).build());
    }

    public DatosFiscalesDTO dto() {
        DatosFiscales d = obtener();
        return new DatosFiscalesDTO(d.getCuit(), d.getRazonSocial(),
                d.getCondicionIva() == null ? null : d.getCondicionIva().name(), d.getIngresosBrutos(),
                d.getInicioActividades(), d.getDomicilioComercial(), d.getPuntoVenta(), d.isIdentificarSocio());
    }

    @Transactional
    public DatosFiscalesDTO guardar(DatosFiscalesDTO pedido) {
        String cuit = pedido.cuit() == null ? "" : pedido.cuit().replaceAll("[\\s.-]", "");
        if (!cuitValida(cuit)) {
            throw new IllegalArgumentException("La CUIT no es válida: son 11 números y el último es un dígito verificador");
        }
        String razonSocial = texto(pedido.razonSocial(), "la razón social o el nombre del dueño", 100);
        if (pedido.condicionIva() == null || pedido.condicionIva().isBlank()) {
            throw new IllegalArgumentException("Elegí la condición frente al IVA (monotributo o responsable inscripto)");
        }
        CondicionIva condicion;
        try {
            condicion = CondicionIva.valueOf(pedido.condicionIva().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Condición frente al IVA desconocida: " + pedido.condicionIva());
        }
        String ingresosBrutos = texto(pedido.ingresosBrutos(), "Ingresos Brutos (el número, o \"Exento\")", 30);
        if (pedido.inicioActividades() == null || pedido.inicioActividades().isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("Completá la fecha de inicio de actividades (no puede ser futura)");
        }
        String domicilio = texto(pedido.domicilioComercial(), "el domicilio comercial del local", 150);
        if (pedido.puntoVenta() == null || pedido.puntoVenta() < 1 || pedido.puntoVenta() > 99998) {
            throw new IllegalArgumentException("Completá el punto de venta (el número que se dio de alta en ARCA, de 1 a 99998)");
        }
        DatosFiscales d = obtener();
        d.setCuit(cuit);
        d.setRazonSocial(razonSocial);
        d.setCondicionIva(condicion);
        d.setIngresosBrutos(ingresosBrutos);
        d.setInicioActividades(pedido.inicioActividades());
        d.setDomicilioComercial(domicilio);
        d.setPuntoVenta(pedido.puntoVenta());
        d.setIdentificarSocio(Boolean.TRUE.equals(pedido.identificarSocio()));
        repository.save(d);
        return dto();
    }

    /** Lo que falta cargar para poder facturar (vacío = está todo). */
    public static List<String> faltantes(DatosFiscales d) {
        List<String> faltan = new ArrayList<>();
        if (!cuitValida(d.getCuit())) faltan.add("CUIT");
        if (vacio(d.getRazonSocial())) faltan.add("razón social");
        if (d.getCondicionIva() == null) faltan.add("condición frente al IVA");
        if (vacio(d.getIngresosBrutos())) faltan.add("Ingresos Brutos");
        if (d.getInicioActividades() == null) faltan.add("inicio de actividades");
        if (vacio(d.getDomicilioComercial())) faltan.add("domicilio comercial");
        if (d.getPuntoVenta() == null) faltan.add("punto de venta");
        return faltan;
    }

    /** 11 dígitos con el dígito verificador correcto (módulo 11). */
    public static boolean cuitValida(String cuit) {
        if (cuit == null || !cuit.matches("\\d{11}")) {
            return false;
        }
        int suma = 0;
        for (int i = 0; i < 10; i++) {
            suma += (cuit.charAt(i) - '0') * PESOS_CUIT[i];
        }
        int verificador = 11 - suma % 11;
        if (verificador == 11) {
            verificador = 0;
        }
        return verificador != 10 && verificador == cuit.charAt(10) - '0';
    }

    /** "20-12345678-6". */
    public static String cuitConGuiones(String cuit) {
        return cuit == null || cuit.length() != 11 ? cuit : cuit.substring(0, 2) + "-" + cuit.substring(2, 10) + "-" + cuit.substring(10);
    }

    private static String texto(String valor, String nombre, int maximo) {
        String limpio = valor == null ? "" : valor.trim();
        if (limpio.isEmpty()) {
            throw new IllegalArgumentException("Completá " + nombre);
        }
        if (limpio.length() > maximo) {
            throw new IllegalArgumentException("Es demasiado largo (" + nombre + "): hasta " + maximo + " caracteres");
        }
        return limpio;
    }

    private static boolean vacio(String valor) {
        return valor == null || valor.isBlank();
    }
}
