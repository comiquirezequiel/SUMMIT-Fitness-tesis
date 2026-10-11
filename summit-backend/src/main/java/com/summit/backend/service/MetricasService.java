package com.summit.backend.service;

import com.summit.backend.model.DebitoAutomatico;
import com.summit.backend.model.EstadoDebito;
import com.summit.backend.model.EstadoPago;
import com.summit.backend.model.MetodoPago;
import com.summit.backend.model.Rol;
import com.summit.backend.repository.DebitoAutomaticoRepository;
import com.summit.backend.repository.LogAsistenciaRepository;
import com.summit.backend.repository.PagoHistorialRepository;
import com.summit.backend.repository.PerfilSocioRepository;
import com.summit.backend.repository.SuscripcionRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Métricas del gimnasio con datos reales, para "Analítica de Socios" (asistencia y perfil de quienes vienen) y
 * "Métricas de Planes" (ingresos aprobados, planes y canales de cobro).
 *
 * <p>Cada indicador se compara con el período anterior del mismo largo (ej. últimos 30 días contra los 30 previos).
 * Las consultas traen filas simples y se agrupan en Java: con el volumen de un gimnasio es rápido y no depende de
 * funciones de fecha propias de MySQL.</p>
 */
@Service
@RequiredArgsConstructor
public class MetricasService {

    private static final int MAX_DIAS = 366;
    // Hasta 62 días el gráfico de ingresos va por día; más largo, por mes
    private static final int MAX_DIAS_POR_DIA = 62;
    private static final String[] DIAS = {"Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"};
    private static final String SIN_DATO = "Sin dato";
    // Orden fijo de categorías: cada una conserva siempre su color en los gráficos
    private static final List<String> RANGOS_EDAD = List.of("Menos de 18", "18 a 25", "26 a 35", "36 a 45", "46 a 55", "56 o más", SIN_DATO);
    private static final List<String> GENEROS = List.of("Masculino", "Femenino", "No binario", "Prefiero no decirlo", SIN_DATO);

    private final LogAsistenciaRepository logAsistenciaRepository;
    private final UsuarioRepository usuarioRepository;
    private final PerfilSocioRepository perfilSocioRepository;
    private final SuscripcionRepository suscripcionRepository;
    private final PagoHistorialRepository pagoHistorialRepository;
    private final DebitoAutomaticoRepository debitoAutomaticoRepository;

    /** Rango pedido (inclusive) y el período anterior del mismo largo, para comparar. */
    public record Periodo(LocalDate desde, LocalDate hasta, int dias, LocalDate desdeAnterior, LocalDate hastaAnterior) {
    }

    /** Un número con su valor en el período anterior (null = foto de hoy, sin comparación). */
    public record Indicador(double valor, Double anterior) {
    }

    /** Un dato de un gráfico: categoría o fecha, y su valor. */
    public record Punto(String clave, double valor) {
    }

    /** Una celda del mapa de calor: día de la semana (0 = lunes ... 6 = domingo) y hora (0 a 23). */
    public record Celda(int dia, int hora, long visitas) {
    }

    public record AnaliticaSocios(Periodo periodo, Map<String, Indicador> indicadores, List<Punto> visitasPorDia,
                                  List<Punto> promedioPorDiaSemana, List<Punto> visitasPorHora, List<Celda> mapaCalor,
                                  List<Punto> edades, List<Punto> generos) {
    }

    public record AnaliticaIngresos(Periodo periodo, Map<String, Indicador> indicadores, String agrupacion,
                                    List<Punto> ingresosEnElTiempo, List<Punto> ingresosPorPlan,
                                    List<Punto> ingresosPorMetodo, List<Punto> ingresosPorCanal,
                                    List<Punto> sociosPorPlan) {
    }

    // ---------- Analítica de socios ----------

    @Transactional(readOnly = true)
    public AnaliticaSocios socios(LocalDate desde, LocalDate hasta) {
        Periodo p = periodo(desde, hasta);
        List<Object[]> visitas = logAsistenciaRepository.ingresosPermitidos(inicio(p.desde()), fin(p.hasta()));
        List<Object[]> visitasAnteriores = logAsistenciaRepository.ingresosPermitidos(inicio(p.desdeAnterior()), fin(p.hastaAnterior()));

        Map<LocalDate, Long> porFecha = new HashMap<>();
        long[][] calor = new long[7][24];
        long[] porHora = new long[24];
        Set<Long> visitantes = new HashSet<>();
        for (Object[] fila : visitas) {
            LocalDateTime cuando = (LocalDateTime) fila[0];
            porFecha.merge(cuando.toLocalDate(), 1L, Long::sum);
            calor[cuando.getDayOfWeek().getValue() - 1][cuando.getHour()]++;
            porHora[cuando.getHour()]++;
            visitantes.add((Long) fila[1]);
        }

        // Día por día (con ceros, para que la línea no "salte" los días sin ingresos)
        List<Punto> visitasPorDia = new ArrayList<>();
        int[] vecesDeCadaDia = new int[7];
        for (LocalDate dia = p.desde(); !dia.isAfter(p.hasta()); dia = dia.plusDays(1)) {
            visitasPorDia.add(new Punto(dia.toString(), porFecha.getOrDefault(dia, 0L)));
            vecesDeCadaDia[dia.getDayOfWeek().getValue() - 1]++;
        }
        // Promedio por día de la semana (un período puede tener 5 lunes y 4 martes: se divide por cuántos hubo)
        List<Punto> promedioPorDiaSemana = new ArrayList<>();
        List<Celda> mapaCalor = new ArrayList<>();
        for (int dia = 0; dia < 7; dia++) {
            long total = Arrays.stream(calor[dia]).sum();
            promedioPorDiaSemana.add(new Punto(DIAS[dia], vecesDeCadaDia[dia] == 0 ? 0 : redondear((double) total / vecesDeCadaDia[dia])));
            for (int hora = 0; hora < 24; hora++) {
                if (calor[dia][hora] > 0) {
                    mapaCalor.add(new Celda(dia, hora, calor[dia][hora]));
                }
            }
        }
        List<Punto> visitasPorHora = new ArrayList<>();
        for (int hora = 0; hora < 24; hora++) {
            visitasPorHora.add(new Punto(String.valueOf(hora), porHora[hora]));
        }

        long unicosAnteriores = visitasAnteriores.stream().map(fila -> (Long) fila[1]).distinct().count();
        Membresias membresias = membresias();

        Map<String, Indicador> indicadores = new LinkedHashMap<>();
        indicadores.put("visitas", new Indicador(visitas.size(), (double) visitasAnteriores.size()));
        indicadores.put("visitantesUnicos", new Indicador(visitantes.size(), (double) unicosAnteriores));
        indicadores.put("promedioPorVisitante", new Indicador(division(visitas.size(), visitantes.size()),
                division(visitasAnteriores.size(), unicosAnteriores)));
        indicadores.put("promedioDiario", new Indicador(division(visitas.size(), p.dias()),
                division(visitasAnteriores.size(), p.dias())));
        indicadores.put("nuevos", new Indicador(nuevos(p.desde(), p.hasta()), (double) nuevos(p.desdeAnterior(), p.hastaAnterior())));
        indicadores.put("bajas", new Indicador(membresias.bajasEntre(p.desde(), p.hasta()),
                (double) membresias.bajasEntre(p.desdeAnterior(), p.hastaAnterior())));
        indicadores.put("sociosActivos", new Indicador(membresias.activosAl(p.hasta()),
                (double) membresias.activosAl(p.hastaAnterior())));

        // Perfil de quienes vinieron en el período (edad y género)
        Map<String, Double> edades = categorias(RANGOS_EDAD);
        Map<String, Double> generos = categorias(GENEROS);
        Set<Long> conPerfil = new HashSet<>();
        if (!visitantes.isEmpty()) {
            LocalDate hoy = LocalDate.now();
            for (Object[] fila : perfilSocioRepository.edadYGenero(visitantes)) {
                conPerfil.add((Long) fila[0]);
                edades.merge(rangoEdad((LocalDate) fila[1], hoy), 1.0, Double::sum);
                String genero = fila[2] == null || fila[2].toString().isBlank() ? SIN_DATO : fila[2].toString();
                generos.merge(GENEROS.contains(genero) ? genero : SIN_DATO, 1.0, Double::sum);
            }
        }
        long sinPerfil = visitantes.size() - conPerfil.size();
        edades.merge(SIN_DATO, (double) sinPerfil, Double::sum);
        generos.merge(SIN_DATO, (double) sinPerfil, Double::sum);

        return new AnaliticaSocios(p, indicadores, visitasPorDia, promedioPorDiaSemana, visitasPorHora, mapaCalor,
                puntos(edades), puntos(generos));
    }

    // ---------- Ingresos y planes ----------

    @Transactional(readOnly = true)
    public AnaliticaIngresos ingresos(LocalDate desde, LocalDate hasta) {
        Periodo p = periodo(desde, hasta);
        List<Object[]> pagos = pagoHistorialRepository.aprobadosEntre(inicio(p.desde()), fin(p.hasta()));
        List<Object[]> pagosAnteriores = pagoHistorialRepository.aprobadosEntre(inicio(p.desdeAnterior()), fin(p.hastaAnterior()));

        boolean porMes = p.dias() > MAX_DIAS_POR_DIA;
        Map<String, Double> enElTiempo = new LinkedHashMap<>();
        if (porMes) {
            for (YearMonth mes = YearMonth.from(p.desde()); !mes.isAfter(YearMonth.from(p.hasta())); mes = mes.plusMonths(1)) {
                enElTiempo.put(mes.toString(), 0.0);
            }
        } else {
            for (LocalDate dia = p.desde(); !dia.isAfter(p.hasta()); dia = dia.plusDays(1)) {
                enElTiempo.put(dia.toString(), 0.0);
            }
        }

        Map<String, Double> porPlan = new HashMap<>();
        Map<String, Double> porMetodo = new HashMap<>();
        double total = 0;
        double presencial = 0;
        double debito = 0;
        for (Object[] fila : pagos) {
            LocalDateTime cuando = (LocalDateTime) fila[0];
            double monto = ((BigDecimal) fila[1]).doubleValue();
            MetodoPago metodo = (MetodoPago) fila[2];
            total += monto;
            enElTiempo.merge(porMes ? YearMonth.from(cuando).toString() : cuando.toLocalDate().toString(), monto, Double::sum);
            porPlan.merge((String) fila[3], monto, Double::sum);
            porMetodo.merge(metodo.name(), monto, Double::sum);
            if (metodo == MetodoPago.DEBITO_AUTOMATICO) {
                debito += monto;
            } else {
                presencial += monto;
            }
        }
        double totalAnterior = pagosAnteriores.stream().mapToDouble(fila -> ((BigDecimal) fila[1]).doubleValue()).sum();

        // Débitos activos y lo que cobran por mes (un plan trimestral aporta un tercio de su monto por mes)
        List<DebitoAutomatico> activos = debitoAutomaticoRepository.findByEstadoInOrderByFechaAltaDesc(List.of(EstadoDebito.ACTIVO));
        double recurrente = activos.stream()
                .mapToDouble(d -> d.getMonto().doubleValue() / Math.max(1, d.getPlan().getDuracionDias() / 30))
                .sum();

        Membresias membresias = membresias();
        Map<String, Indicador> indicadores = new LinkedHashMap<>();
        indicadores.put("ingresos", new Indicador(redondear(total), redondear(totalAnterior)));
        indicadores.put("cobros", new Indicador(pagos.size(), (double) pagosAnteriores.size()));
        indicadores.put("ticketPromedio", new Indicador(division(total, pagos.size()), division(totalAnterior, pagosAnteriores.size())));
        indicadores.put("sociosActivos", new Indicador(membresias.activosAl(p.hasta()), (double) membresias.activosAl(p.hastaAnterior())));
        indicadores.put("debitosActivos", new Indicador(activos.size(), null));
        indicadores.put("cobroRecurrente", new Indicador(redondear(recurrente), null));
        indicadores.put("pendientesVerificar", new Indicador(pagoHistorialRepository.countByEstadoPago(EstadoPago.PENDIENTE), null));
        indicadores.put("montoPendiente", new Indicador(pagoHistorialRepository.sumarPorEstado(EstadoPago.PENDIENTE).doubleValue(), null));

        List<Punto> porCanal = List.of(new Punto("Presencial", redondear(presencial)), new Punto("Débito automático", redondear(debito)));

        return new AnaliticaIngresos(p, indicadores, porMes ? "MES" : "DIA", puntos(enElTiempo),
                ordenadosDeMayorAMenor(porPlan), ordenadosDeMayorAMenor(porMetodo), porCanal,
                ordenadosDeMayorAMenor(membresias.sociosPorPlanAl(LocalDate.now())));
    }

    // ---------- Membresías (activos, bajas, socios por plan) ----------

    private Membresias membresias() {
        return new Membresias(suscripcionRepository.vencimientosConPlan());
    }

    /** Filas [idUsuario, plan, inicio, vencimiento] de todas las membresías, con los cálculos que se hacen sobre ellas. */
    private record Membresias(List<Object[]> filas) {

        /** Socios con una membresía que cubre esa fecha. */
        long activosAl(LocalDate fecha) {
            return filas.stream()
                    .filter(f -> !((LocalDate) f[2]).isAfter(fecha) && !((LocalDate) f[3]).isBefore(fecha))
                    .map(f -> (Long) f[0]).distinct().count();
        }

        /**
         * Bajas: socios cuya última membresía venció dentro del rango y no la renovaron (hasta hoy).
         */
        long bajasEntre(LocalDate desde, LocalDate hasta) {
            LocalDate tope = hasta.isBefore(LocalDate.now()) ? hasta : LocalDate.now().minusDays(1);
            if (tope.isBefore(desde)) {
                return 0;
            }
            Map<Long, LocalDate> ultimoVencimiento = new HashMap<>();
            for (Object[] f : filas) {
                ultimoVencimiento.merge((Long) f[0], (LocalDate) f[3], (a, b) -> a.isAfter(b) ? a : b);
            }
            return ultimoVencimiento.values().stream()
                    .filter(v -> !v.isBefore(desde) && !v.isAfter(tope))
                    .count();
        }

        /** Cuántos socios activos tiene cada plan (por su membresía vigente más reciente). */
        Map<String, Double> sociosPorPlanAl(LocalDate fecha) {
            Map<Long, Object[]> vigentePorSocio = new HashMap<>();
            for (Object[] f : filas) {
                if (((LocalDate) f[2]).isAfter(fecha) || ((LocalDate) f[3]).isBefore(fecha)) {
                    continue;
                }
                vigentePorSocio.merge((Long) f[0], f, (a, b) -> ((LocalDate) a[3]).isAfter((LocalDate) b[3]) ? a : b);
            }
            Map<String, Double> porPlan = new HashMap<>();
            vigentePorSocio.values().forEach(f -> porPlan.merge((String) f[1], 1.0, Double::sum));
            return porPlan;
        }
    }

    // ---------- Auxiliares ----------

    private static Periodo periodo(LocalDate desde, LocalDate hasta) {
        LocalDate hoy = LocalDate.now();
        LocalDate fin = hasta == null || hasta.isAfter(hoy) ? hoy : hasta;
        LocalDate inicio = desde == null ? fin.minusDays(29) : desde;
        if (inicio.isAfter(fin)) {
            throw new IllegalArgumentException("La fecha de inicio no puede ser posterior a la de fin");
        }
        int dias = (int) ChronoUnit.DAYS.between(inicio, fin) + 1;
        if (dias > MAX_DIAS) {
            throw new IllegalArgumentException("El período no puede superar un año");
        }
        return new Periodo(inicio, fin, dias, inicio.minusDays(dias), inicio.minusDays(1));
    }

    private long nuevos(LocalDate desde, LocalDate hasta) {
        return usuarioRepository.countByRolAndFechaCreacionGreaterThanEqualAndFechaCreacionLessThan(Rol.SOCIO, inicio(desde), fin(hasta));
    }

    private static LocalDateTime inicio(LocalDate dia) {
        return dia.atStartOfDay();
    }

    // Fin exclusivo: el comienzo del día siguiente (así entra todo el último día)
    private static LocalDateTime fin(LocalDate dia) {
        return dia.plusDays(1).atStartOfDay();
    }

    private static String rangoEdad(LocalDate nacimiento, LocalDate hoy) {
        if (nacimiento == null) {
            return SIN_DATO;
        }
        int anios = Period.between(nacimiento, hoy).getYears();
        if (anios < 18) return "Menos de 18";
        if (anios <= 25) return "18 a 25";
        if (anios <= 35) return "26 a 35";
        if (anios <= 45) return "36 a 45";
        if (anios <= 55) return "46 a 55";
        return "56 o más";
    }

    private static Map<String, Double> categorias(List<String> nombres) {
        Map<String, Double> mapa = new LinkedHashMap<>();
        nombres.forEach(n -> mapa.put(n, 0.0));
        return mapa;
    }

    private static List<Punto> puntos(Map<String, Double> mapa) {
        return mapa.entrySet().stream().map(e -> new Punto(e.getKey(), redondear(e.getValue()))).toList();
    }

    private static List<Punto> ordenadosDeMayorAMenor(Map<String, Double> mapa) {
        return mapa.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue(Comparator.reverseOrder()))
                .map(e -> new Punto(e.getKey(), redondear(e.getValue())))
                .toList();
    }

    private static double division(double a, double b) {
        return b == 0 ? 0 : redondear(a / b);
    }

    private static double redondear(double valor) {
        return Math.round(valor * 10) / 10.0;
    }
}
