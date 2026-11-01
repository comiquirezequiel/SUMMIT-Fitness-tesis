package com.summit.backend.config;

import com.summit.backend.model.CategoriaGasto;
import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.model.CierreCaja;
import com.summit.backend.model.Clase;
import com.summit.backend.model.ConfiguracionAcceso;
import com.summit.backend.model.Congelamiento;
import com.summit.backend.model.DebitoAutomatico;
import com.summit.backend.model.Descuento;
import com.summit.backend.model.EstadoDebito;
import com.summit.backend.model.EstadoLegalCertificado;
import com.summit.backend.model.EstadoPago;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.Gasto;
import com.summit.backend.model.HorarioGimnasio;
import com.summit.backend.model.LogAsistencia;
import com.summit.backend.model.MetodoPago;
import com.summit.backend.model.MotivoCongelamiento;
import com.summit.backend.model.OrigenTurno;
import com.summit.backend.model.PagoHistorial;
import com.summit.backend.model.PerfilSocio;
import com.summit.backend.model.Plan;
import com.summit.backend.model.ReglasMembresia;
import com.summit.backend.model.ResultadoAsistencia;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Suscripcion;
import com.summit.backend.model.TipoDescuento;
import com.summit.backend.model.TipoEventoAsistencia;
import com.summit.backend.model.TotalMetodoCierre;
import com.summit.backend.model.TurnoPersonal;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.CertificadoMedicoRepository;
import com.summit.backend.repository.CierreCajaRepository;
import com.summit.backend.repository.ClaseRepository;
import com.summit.backend.repository.CongelamientoRepository;
import com.summit.backend.repository.DebitoAutomaticoRepository;
import com.summit.backend.repository.DescuentoRepository;
import com.summit.backend.repository.GastoRepository;
import com.summit.backend.repository.LogAsistenciaRepository;
import com.summit.backend.repository.PagoHistorialRepository;
import com.summit.backend.repository.PerfilSocioRepository;
import com.summit.backend.repository.PlanRepository;
import com.summit.backend.repository.SuscripcionRepository;
import com.summit.backend.repository.TurnoPersonalRepository;
import com.summit.backend.repository.UsuarioRepository;
import com.summit.backend.service.ConfiguracionAccesoService;
import com.summit.backend.service.DatosGimnasioService;
import com.summit.backend.service.DescuentoService;
import com.summit.backend.service.ReglasMembresiaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.Normalizer;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.MonthDay;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * Datos de demostración: simula que el gimnasio abrió hace 6 meses, para ver funcionando las métricas, la caja, los
 * cobros, el seguimiento y el control de acceso con datos creíbles.
 *
 * <p>Arranca con 30 socios la primera semana y llega a 80 al cumplir 5 meses; el último mes no entran socios nuevos.
 * Cada socio tiene su plan, su medio de pago, sus horarios y su certificado médico, elegidos al azar con pesos
 * realistas (no en partes iguales): algunos pagan tarde, otros se van y algunos vuelven. También simula 7 empleados con
 * sus turnos, los gastos del local y los cierres de caja de recepción.</p>
 *
 * <p>Solo corre con DEMO=true y con la base sin socios: nunca toca una base con datos. La contraseña de todos los
 * usuarios que crea es DEMO_PASSWORD. La misma semilla (DEMO_SEMILLA) da siempre los mismos datos.</p>
 */
@Component
@ConditionalOnProperty(name = "summit.demo.habilitada", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class DatosDemo {

    private static final int SOCIOS_INICIALES = 30;
    private static final int SOCIOS_TOTALES = 80;
    private static final int MESES_ABIERTO = 6;
    // A los 5 meses ya están los 80: el último mes no se inscribe nadie nuevo
    private static final int MESES_CRECIMIENTO = 5;
    private static final BigDecimal FONDO_DE_CAJA = new BigDecimal("20000.00");
    private static final Set<MetodoPago> VERIFICABLES = EnumSet.of(MetodoPago.TRANSFERENCIA, MetodoPago.MERCADO_PAGO);
    // Los feriados abre con el horario del sábado (no cierra: las métricas no conocen los feriados y lo mostrarían como
    // un día sin gente)
    private static final Set<MonthDay> FERIADOS = Set.of(MonthDay.of(1, 1), MonthDay.of(5, 1), MonthDay.of(5, 25),
            MonthDay.of(6, 15), MonthDay.of(6, 20), MonthDay.of(7, 9), MonthDay.of(7, 10), MonthDay.of(8, 17),
            MonthDay.of(10, 12), MonthDay.of(11, 23), MonthDay.of(12, 8), MonthDay.of(12, 25));
    private static final MonthDay INICIO_RECESO_INVERNAL = MonthDay.of(7, 13);
    private static final MonthDay FIN_RECESO_INVERNAL = MonthDay.of(7, 24);

    private final UsuarioRepository usuarioRepository;
    private final PerfilSocioRepository perfilSocioRepository;
    private final PlanRepository planRepository;
    private final DescuentoRepository descuentoRepository;
    private final SuscripcionRepository suscripcionRepository;
    private final PagoHistorialRepository pagoHistorialRepository;
    private final CertificadoMedicoRepository certificadoMedicoRepository;
    private final LogAsistenciaRepository logAsistenciaRepository;
    private final TurnoPersonalRepository turnoPersonalRepository;
    private final CongelamientoRepository congelamientoRepository;
    private final DebitoAutomaticoRepository debitoAutomaticoRepository;
    private final GastoRepository gastoRepository;
    private final CierreCajaRepository cierreCajaRepository;
    private final ClaseRepository claseRepository;
    private final ReglasMembresiaService reglasMembresiaService;
    private final ConfiguracionAccesoService configuracionAccesoService;
    private final DatosGimnasioService datosGimnasioService;
    private final PasswordEncoder passwordEncoder;
    private final PlatformTransactionManager transactionManager;

    @Value("${summit.demo.password}")
    private String password;

    @Value("${summit.demo.semilla}")
    private long semilla;

    @Value("${summit.uploads.dir}")
    private String directorioArchivos;

    /**
     * Después de DataSeeder (que corre antes de que la aplicación quede lista): ya están el admin, los planes y las
     * reglas. Todo en una sola transacción: si algo falla, la base queda como estaba.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void cargar() {
        if (password.isBlank()) {
            log.warn("No se cargaron los datos de demostración: falta DEMO_PASSWORD en application-local.properties");
            return;
        }
        if (usuarioRepository.countByRol(Rol.SOCIO) > 0) {
            log.info("No se cargaron los datos de demostración: la base ya tiene socios");
            return;
        }
        long inicio = System.currentTimeMillis();
        log.warn("Cargando los datos de demostración (6 meses de gimnasio): tarda un rato...");
        Simulacion simulacion = new TransactionTemplate(transactionManager).execute(estado -> {
            Simulacion nueva = new Simulacion();
            nueva.ejecutar();
            return nueva;
        });
        log.warn("Datos de demostración cargados en {} s: {}", (System.currentTimeMillis() - inicio) / 1000, simulacion.resumen());
    }

    // ---------- Catálogos ----------

    private static final String[] NOMBRES_MUJER = {"Lucía", "Martina", "Sofía", "Valentina", "Julieta", "Agustina",
            "Micaela", "Antonella", "Rocío", "Milagros", "Carolina", "Daniela", "Paula", "Belén", "Luciana", "Victoria",
            "Romina", "Natalia", "Gabriela", "Silvina", "Mariana", "Lorena", "Verónica", "Andrea", "Celeste", "Abril",
            "Catalina", "Delfina", "Josefina", "Pilar", "Brenda", "Jimena", "Noelia", "Soledad", "Marisa", "Graciela",
            "Susana", "Norma", "Patricia", "Claudia", "Alejandra", "Eugenia", "Malena", "Candela", "Ailén", "Ayelén",
            "Tamara", "Yanina", "Melina", "Aldana", "Sabrina", "Guadalupe", "Emilia", "Constanza", "Florencia"};
    private static final String[] NOMBRES_HOMBRE = {"Martín", "Juan", "Lucas", "Mateo", "Santiago", "Nicolás", "Matías",
            "Facundo", "Tomás", "Joaquín", "Agustín", "Franco", "Gonzalo", "Diego", "Pablo", "Federico", "Sebastián",
            "Ezequiel", "Leandro", "Maximiliano", "Ignacio", "Rodrigo", "Emiliano", "Bruno", "Thiago", "Benjamín",
            "Lautaro", "Valentín", "Gastón", "Hernán", "Marcelo", "Gustavo", "Sergio", "Jorge", "Carlos", "Ricardo",
            "Daniel", "Alejandro", "Fernando", "Claudio", "Mauricio", "Ramiro", "Cristian", "Damián", "Germán", "Julián",
            "Iván", "Axel", "Alan", "Walter", "Rubén", "Osvaldo", "Hugo", "Elías", "Gabriel"};
    private static final String[] APELLIDOS = {"González", "Rodríguez", "Gómez", "Fernández", "López", "Díaz",
            "Martínez", "Pérez", "García", "Sánchez", "Romero", "Sosa", "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores",
            "Acosta", "Benítez", "Medina", "Suárez", "Herrera", "Aguirre", "Pereyra", "Gutiérrez", "Giménez", "Molina",
            "Silva", "Castro", "Rojas", "Ortiz", "Núñez", "Luna", "Juárez", "Cabrera", "Ríos", "Godoy", "Morales",
            "Domínguez", "Moreno", "Peralta", "Vega", "Carrizo", "Castillo", "Ledesma", "Ojeda", "Ponce", "Vera",
            "Villalba", "Cardozo", "Coronel", "Vázquez", "Figueroa", "Paz", "Jara", "Cifuentes", "Painemal", "Huenchul",
            "Catalán", "Antileo", "Zapata", "Fuentes", "Contreras", "Valdebenito", "Mansilla", "Barrionuevo", "Bustos",
            "Arce", "Miranda", "Toledo", "Salinas", "Maldonado", "Correa", "Lagos", "Cárdenas", "Ávila", "Escobar",
            "Rivas", "Montenegro", "Sandoval", "Bravo", "Leiva", "Olivera", "Retamal", "Quilapán", "Soto", "Vidal"};
    private static final String[] CALLES = {"Av. Argentina", "Av. Olascoaga", "Belgrano", "Leloir", "Mitre", "Sarmiento",
            "Perito Moreno", "Santa Fe", "Alderete", "Rivadavia", "San Martín", "Linares", "Fotheringham", "Godoy",
            "Bahía Blanca", "Antártida Argentina", "Juan B. Justo", "Lanín", "Tucumán", "Córdoba", "Entre Ríos",
            "La Pampa", "Brown", "Saturnino Torres", "Láinez", "Av. Mosconi", "Ministro González", "Jujuy", "Elordi",
            "Talero", "Chaneton", "Buenos Aires", "Corrientes", "Islas Malvinas", "Planas", "Copahue"};
    private static final String[] OBJETIVOS = {"Bajar de peso", "Ganar masa muscular", "Mejorar la condición física",
            "Tonificar", "Rehabilitación de una lesión", "Preparación para carreras de calle", "Salud y bienestar",
            "Complementar el fútbol", "Reducir el estrés", "Mejorar la postura", "Ganar fuerza",
            "Preparación física para el ingreso a la policía", "Volver a entrenar después de años"};
    private static final String[] OBSERVACIONES = {"Prefiere que le escriban por WhatsApp.",
            "Viene con un amigo que todavía no se inscribió.", "Pidió rutina para entrenar en poco tiempo (40 minutos).",
            "Trabaja en el yacimiento con diagrama 14x14: viene por temporadas.", "Lo recomendó otro socio.",
            "Consultó por clases de funcional.", "Quiere el plan anual si se lanza.", "Pregunta seguido por los horarios del sábado."};
    private static final String[] MEDICOS = {"Dra. Laura Méndez - Medicina general - M.P. 4821",
            "Dr. Pablo Iturra - Clínica médica - M.P. 3307", "Dra. Carla Benedetti - Cardiología - M.P. 5190",
            "Dr. Esteban Ruiz Díaz - Medicina del deporte - M.P. 2764", "Dra. Natalia Krause - Clínica médica - M.P. 6038",
            "Dr. Hugo Saavedra - Traumatología - M.P. 1985"};

    /** Una patología posible del certificado, con lo que el asistente de IA resume para el profesor. */
    private record Patologia(String texto, String indicacion, double pesoJoven, double pesoMayor) {}

    // Los textos no llevan comas: el certificado separa las patologías con comas. Las que nombran la zona (LUMBAR,
    // RODILLA, HOMBRO, CERVICAL, HERNIA) marcan los ejercicios contraindicados en el constructor de rutinas
    private static final List<Patologia> PATOLOGIAS = List.of(
            new Patologia("Hernia de disco lumbar L4-L5", "Evitar cargas axiales y flexión de columna con peso.", 0.8, 1.6),
            new Patologia("Lumbalgia crónica en zona lumbar", "Evitar peso muerto y remos pesados; fortalecer la zona media.", 1.0, 1.8),
            new Patologia("Escoliosis dorsolumbar leve", "Trabajo simétrico; sin sobrecargas en la columna lumbar.", 1.0, 0.5),
            new Patologia("Protrusión discal cervical C5-C6", "Evitar press por encima de la cabeza y cargas sobre el cuello.", 0.4, 1.2),
            new Patologia("Cervicalgia por contractura en zona cervical", "Evitar ejercicios que tensionen el cuello; elongar.", 0.9, 1.0),
            new Patologia("Condromalacia rotuliana en rodilla derecha", "Evitar sentadilla profunda y extensiones con mucha carga.", 1.2, 0.8),
            new Patologia("Operado de ligamento cruzado anterior de rodilla izquierda (2023)", "Progresión gradual en ejercicios de rodilla y sin saltos.", 1.0, 0.5),
            new Patologia("Artrosis de rodilla bilateral", "Bajo impacto: bicicleta y fuerza sin cargas altas en rodilla.", 0.1, 1.8),
            new Patologia("Tendinitis del manguito rotador en hombro derecho", "Evitar press militar y fondos; trabajar con bandas.", 0.8, 1.2),
            new Patologia("Luxación de hombro izquierdo (2021)", "Evitar rotación externa forzada y dominadas con carga.", 0.9, 0.3),
            new Patologia("Hernia inguinal operada", "Evitar maniobras de Valsalva con cargas máximas.", 0.3, 0.9),
            new Patologia("Hipertensión arterial controlada con medicación", "Evitar esfuerzos máximos y apneas; controlar la presión.", 0.2, 2.6),
            new Patologia("Asma bronquial leve", "Tener a mano el broncodilatador; calentamiento progresivo.", 1.5, 0.7),
            new Patologia("Diabetes tipo 2 en tratamiento", "Controlar la glucemia antes y después de entrenar.", 0.1, 1.6),
            new Patologia("Diabetes tipo 1", "Controlar la glucemia y avisar ante síntomas de hipoglucemia.", 0.5, 0.3),
            new Patologia("Hipotiroidismo en tratamiento", "Sin restricciones para la actividad física.", 0.6, 1.2),
            new Patologia("Arritmia leve en control cardiológico", "Intensidad moderada; sin esfuerzos máximos.", 0.2, 1.0),
            new Patologia("Esguince de tobillo derecho a repetición", "Fortalecer el tobillo y la propiocepción; cuidado en saltos.", 1.3, 0.4),
            new Patologia("Fascitis plantar", "Evitar el impacto prolongado en la cinta; elongar la fascia.", 0.5, 1.0),
            new Patologia("Epicondilitis lateral (codo de tenista)", "Evitar agarres prolongados con carga.", 0.4, 0.9),
            new Patologia("Sobrepeso (IMC 29)", "Progresión gradual combinando fuerza y aeróbico.", 0.9, 1.4),
            new Patologia("Obesidad grado I", "Bajo impacto al comienzo y progresión gradual.", 0.5, 0.9),
            new Patologia("Anemia ferropénica en tratamiento", "Intensidad moderada hasta normalizar los valores.", 0.8, 0.3),
            new Patologia("Migraña crónica", "Hidratación; evitar maniobras de Valsalva intensas.", 0.8, 0.6));

    // ---------- Simulación ----------

    private enum Perfil { ESTUDIANTE, TRABAJADOR, JUBILADO }

    private record Empleado(Usuario usuario, String puesto, LocalDate ingreso, int sueldo) {}

    /** Un congelamiento que va a pedir algún socio ese día (el que tenga la membresía vigente). */
    private record Congelar(LocalDate desde, int dias, MotivoCongelamiento motivo, String observacion) {}

    /** Un certificado y el día en que el socio lo presentó. */
    private static final class Apto {
        CertificadoMedico certificado;
        LocalDate carga;
        LocalDate rechazadoDesde; // el falso: deja de habilitar el ingreso desde que se revisó
        String medico;
    }

    /** Un socio y cómo se comporta (lo que no se guarda en la base). */
    private static final class Socio {
        Usuario usuario;
        PerfilSocio perfil;
        LocalDateTime alta;
        int edad;
        Perfil tipo;
        Plan plan;
        Plan planSiguiente;
        MetodoPago metodo;
        Descuento descuento;
        String especialMotivo;
        BigDecimal especialMonto;
        double hora;
        double franjaDiaCorto;
        final double[] pesosDias = new double[7];
        double frecuencia;
        double compromiso = 1.1;
        double riesgo;
        int puntualidad; // 0 puntual, 1 a veces tarde, 2 muy tarde
        int diasDeMargen; // paga desde vencimiento + esto (negativo = antes de que venza)
        int ciclos;
        boolean seVa;
        boolean baja;
        LocalDate vuelve;
        Suscripcion suscripcion;
        DebitoAutomatico debito;
        boolean pagoPendiente;
        boolean pagaEnEfectivo;
        int excepciones;
        String patologias;
        final List<Apto> aptos = new ArrayList<>();
        LocalDate renovacionApto;
        LocalDate ultimoRechazoApto;
        Congelamiento congelamiento;
        final Set<LocalDate> semana = new HashSet<>();
        LocalDate diaExtra;
        final TreeSet<LocalDate> diasConIngreso = new TreeSet<>();

        LocalDate diaAlta() {
            return alta.toLocalDate();
        }

        LocalDate vence() {
            return suscripcion != null ? suscripcion.getFechaVencimiento() : null;
        }

        boolean debitoActivo() {
            return debito != null && debito.getEstado() == EstadoDebito.ACTIVO;
        }
    }

    private final class Simulacion {

        private final Random azar = new Random(semilla);
        private final LocalDateTime ahora = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        private final LocalDate hoy = ahora.toLocalDate();
        // El horario de Datos del gimnasio: los días que no abre no hay movimiento
        private final Map<DayOfWeek, HorarioGimnasio> horario = datosGimnasioService.horarioSemanal();
        private final LocalDate apertura = proximoDiaAbierto(hoy.minusMonths(MESES_ABIERTO));
        // Los precios de los planes subieron (al de hoy) a los 3 meses de abrir; antes eran un 10 % más bajos
        private final LocalDate aumento = YearMonth.from(apertura).plusMonths(4).atDay(1);
        private final String hash = passwordEncoder.encode(password);
        private final ReglasMembresia reglas = reglasMembresiaService.obtener();
        private final ConfiguracionAcceso acceso = configuracionAccesoService.obtenerConfiguracionGlobal();
        private final Usuario dueno = usuarioRepository.findAll().stream()
                .filter(u -> u.getRol() == Rol.ADMIN).min(Comparator.comparing(Usuario::getIdUsuario)).orElseThrow();

        private final List<Empleado> empleados = new ArrayList<>();
        private Empleado encargada;
        private final Map<LocalDate, List<TurnoPersonal>> turnosPorDia = new HashMap<>();
        private final List<Socio> socios = new ArrayList<>();
        private final List<LogAsistencia> logs = new ArrayList<>();
        private final List<TurnoPersonal> turnos = new ArrayList<>();
        private final List<Suscripcion> suscripciones = new ArrayList<>();
        private final List<PagoHistorial> pagos = new ArrayList<>();
        private final List<Congelamiento> congelamientos = new ArrayList<>();
        private final List<DebitoAutomatico> debitos = new ArrayList<>();
        private final List<Gasto> gastos = new ArrayList<>();
        private final List<CierreCaja> cierres = new ArrayList<>();
        private final List<Congelar> porCongelar = new ArrayList<>();
        private final Set<String> dnis = new HashSet<>();
        private final Set<String> emails = new HashSet<>();
        private final Set<String> nombres = new HashSet<>();
        private final Map<String, Plan> planes = new HashMap<>();
        private Descuento familiar;
        private Descuento estudiante;
        private Descuento jubilado;
        private int pendientes;
        private int rechazados;
        private long operacion = 40_000_000L + Math.abs(semilla % 1000) * 1000;

        void ejecutar() {
            prepararCatalogos();
            crearEmpleados();
            generarTurnos();
            crearSocios();
            simular();
            generarGastos();
            cerrarCajas();
            guardar();
        }

        String resumen() {
            long activos = socios.stream().filter(s -> s.vence() != null && !s.vence().isBefore(hoy)).count();
            return String.format("abrió el %s, %d socios (%d con la cuota al día), %d empleados, %d cobros, %d ingresos "
                            + "registrados, %d gastos y %d cierres de caja", apertura, socios.size(), activos, empleados.size(),
                    pagos.size(), logs.size(), gastos.size(), cierres.size());
        }

        // ---------- Catálogos ----------

        private void prepararCatalogos() {
            for (Plan plan : planRepository.findAll()) {
                planes.put(plan.getNombrePlan(), plan);
            }
            if (!planes.containsKey("Pase Libre") || !planes.containsKey("3 veces por semana")
                    || !planes.containsKey("2 veces por semana")) {
                throw new IllegalStateException("Faltan los planes base (los crea DataSeeder)");
            }
            familiar = descuento("familiar", TipoDescuento.PORCENTAJE, "10");
            estudiante = descuento("Estudiante", TipoDescuento.PORCENTAJE, "15");
            jubilado = descuento("Jubilado", TipoDescuento.PORCENTAJE, "20");
        }

        // El del catálogo si ya existe (sin importar mayúsculas), si no lo crea
        private Descuento descuento(String nombre, TipoDescuento tipo, String valor) {
            return descuentoRepository.findAll().stream()
                    .filter(d -> d.getNombre().equalsIgnoreCase(nombre))
                    .findFirst()
                    .orElseGet(() -> descuentoRepository.save(Descuento.builder()
                            .nombre(nombre).tipo(tipo).valor(new BigDecimal(valor)).activo(true).build()));
        }

        // ---------- Personal ----------

        private void crearEmpleados() {
            encargada = empleado("Valeria Paredes", Rol.ADMIN, "ENCARGADA", apertura.minusDays(40), 140_000, 1986);
            empleado("Camila Sepúlveda", Rol.RECEPCION, "RECEPCION_MANANA", apertura.minusDays(12), 90_000, 1999);
            empleado("Nicolás Ferreyra", Rol.RECEPCION, "RECEPCION_TARDE", apertura.minusDays(12), 90_000, 1996);
            // Entró a los dos meses y medio, cuando crecieron los socios: sábados y refuerzo en la hora pico
            empleado("Agustina Muñoz", Rol.RECEPCION, "RECEPCION_PARCIAL", proximoDiaHabil(apertura.plusDays(68)), 50_000, 2003);
            empleado("Martín Quiroga", Rol.PROFESOR, "PROFESOR_MANANA", apertura.minusDays(12), 85_000, 1990);
            empleado("Lucas Navarro", Rol.PROFESOR, "PROFESOR_TARDE", apertura.minusDays(12), 85_000, 1994);
            empleado("Florencia Ibáñez", Rol.PROFESOR, "PROFESOR_PARCIAL", proximoDiaHabil(apertura.plusDays(96)), 45_000, 1998);
        }

        private Empleado empleado(String nombre, Rol rol, String puesto, LocalDate ingreso, int sueldo, int anioNacimiento) {
            String email = sinTildes(nombre).toLowerCase(Locale.ROOT).replace(' ', '.') + "@summit.com";
            Usuario usuario = usuarioRepository.save(Usuario.builder()
                    .dni(dni(anioNacimiento))
                    .nombreCompleto(nombre)
                    .email(email)
                    .password(hash)
                    .telefono(telefono())
                    .rol(rol)
                    .estado(EstadoUsuario.ACTIVO)
                    .debeCambiarPassword(false)
                    .build());
            // prePersist la pone en "ahora": se corrige y Hibernate la actualiza al confirmar la transacción
            usuario.setFechaCreacion(ingreso.atTime(10, entre(0, 59)));
            emails.add(email);
            Empleado empleado = new Empleado(usuario, puesto, ingreso, sueldo);
            empleados.add(empleado);
            return empleado;
        }

        private Empleado empleado(String puesto) {
            return empleados.stream().filter(e -> e.puesto().equals(puesto)).findFirst().orElseThrow();
        }

        /**
         * Turnos del personal según el horario del gimnasio: cada uno ficha en recepción al entrar y al salir. Los días
         * largos se reparten en mañana y tarde (cambio de turno a mitad del día); los cortos (el sábado) los cubre una
         * sola persona por puesto.
         */
        private void generarTurnos() {
            Set<LocalDate> vacacionesManana = diasHabilesDesde(fechaDelAnio(7, 20), 7);
            Set<LocalDate> vacacionesProfesorTarde = diasHabilesDesde(apertura.plusDays(130), 5);
            LocalDate ingresoParcial = empleado("RECEPCION_PARCIAL").ingreso();
            LocalDate ingresoProfesora = empleado("PROFESOR_PARCIAL").ingreso();
            for (LocalDate d = apertura; !d.isAfter(hoy); d = d.plusDays(1)) {
                if (cerrado(d)) {
                    continue;
                }
                boolean corto = diaCorto(d);
                LocalTime abre = horarioDe(d).getAbre();
                LocalTime cierra = horarioDe(d).getCierra();
                LocalTime mitad = cambioDeTurno(d);
                boolean semanaPar = ChronoUnit.WEEKS.between(apertura, d) % 2 == 0;
                DayOfWeek dia = d.getDayOfWeek();
                for (Empleado e : empleados) {
                    if (d.isBefore(e.ingreso())) {
                        continue;
                    }
                    switch (e.puesto()) {
                        case "ENCARGADA" -> {
                            if (!corto && !probabilidad(0.1)) {
                                if (probabilidad(0.2)) {
                                    turno(e, d, LocalTime.of(10, 0), LocalTime.of(14, 0));
                                } else {
                                    turno(e, d, LocalTime.of(9, 30), LocalTime.of(17, 30));
                                }
                            }
                        }
                        case "RECEPCION_MANANA" -> {
                            if (!corto && !vacacionesManana.contains(d)) {
                                turno(e, d, abre.minusMinutes(15), mitad.plusMinutes(5));
                            } else if (corto && d.isBefore(ingresoParcial) && semanaPar) {
                                turno(e, d, abre.minusMinutes(15), cierra.plusMinutes(10));
                            }
                        }
                        case "RECEPCION_TARDE" -> {
                            if (!corto) {
                                turno(e, d, mitad, cierra.plusMinutes(10));
                            } else if (d.isBefore(ingresoParcial) && !semanaPar) {
                                turno(e, d, abre.minusMinutes(15), cierra.plusMinutes(10));
                            }
                        }
                        case "RECEPCION_PARCIAL" -> {
                            if (corto) {
                                turno(e, d, abre.minusMinutes(15), cierra.plusMinutes(10));
                            } else if (vacacionesManana.contains(d)) {
                                turno(e, d, abre.minusMinutes(15), mitad.plusMinutes(5)); // cubre las vacaciones de la mañana
                            } else if (dia == DayOfWeek.TUESDAY || dia == DayOfWeek.THURSDAY) {
                                turno(e, d, cierra.minusMinutes(270), cierra.minusMinutes(30)); // refuerzo en la hora pico
                            }
                        }
                        case "PROFESOR_MANANA" -> {
                            if (!corto) {
                                turno(e, d, abre.minusMinutes(5), mitad.minusHours(1));
                            } else if (d.isBefore(ingresoProfesora)) {
                                turno(e, d, abre.minusMinutes(5), cierra.plusMinutes(5));
                            }
                        }
                        case "PROFESOR_TARDE" -> {
                            if (!corto && !vacacionesProfesorTarde.contains(d)) {
                                turno(e, d, mitad.plusMinutes(55), cierra.plusMinutes(5));
                            }
                        }
                        case "PROFESOR_PARCIAL" -> {
                            if (corto) {
                                turno(e, d, abre.minusMinutes(5), cierra.plusMinutes(5));
                            } else if (dia == DayOfWeek.MONDAY || dia == DayOfWeek.WEDNESDAY || dia == DayOfWeek.FRIDAY) {
                                turno(e, d, mitad.minusMinutes(125), mitad.plusHours(2));
                            }
                        }
                        default -> throw new IllegalStateException("Puesto desconocido: " + e.puesto());
                    }
                }
            }
        }

        // Un turno con lo que pasa de verdad: faltas por enfermedad, llegadas tarde y algún olvido de fichar la salida
        private void turno(Empleado e, LocalDate d, LocalTime entradaBase, LocalTime salidaBase) {
            if (!e.puesto().equals("ENCARGADA") && probabilidad(0.02)) {
                return;
            }
            int demora = (int) Math.round(azar.nextGaussian() * 4) - 3 + (probabilidad(0.07) ? entre(8, 25) : 0);
            LocalDateTime entrada = d.atTime(entradaBase).plusMinutes(demora).plusSeconds(entre(0, 59));
            LocalDateTime salida = d.atTime(salidaBase).plusMinutes(Math.round(azar.nextGaussian() * 6) + 4)
                    .plusSeconds(entre(0, 59));
            if (entrada.isAfter(ahora)) {
                return;
            }
            boolean enCurso = salida.isAfter(ahora);
            // Los olvidos viejos ya los corrigió el admin: quedan solo los del último mes, para que se vean pendientes
            boolean olvido = !enCurso && d.isAfter(hoy.minusDays(25)) && probabilidad(0.012);
            Usuario persona = e.usuario();
            LogAsistencia logEntrada = log(persona, entrada, TipoEventoAsistencia.INGRESO_MOLINETE, ResultadoAsistencia.PERMITIDO);
            LogAsistencia logSalida = enCurso || olvido ? null
                    : log(persona, salida, TipoEventoAsistencia.CHECKOUT, ResultadoAsistencia.PERMITIDO);
            TurnoPersonal turno = TurnoPersonal.builder()
                    .usuario(persona)
                    .entrada(entrada)
                    .salida(logSalida != null ? salida : null)
                    .origen(OrigenTurno.RECEPCION)
                    .anulado(false)
                    .logEntrada(logEntrada)
                    .logSalida(logSalida)
                    .build();
            turnos.add(turno);
            turnosPorDia.computeIfAbsent(d, x -> new ArrayList<>()).add(turno);
        }

        /** Quién estaba en recepción en ese momento (registra el cobro o el gasto); si no hay nadie, la encargada o el dueño. */
        private Usuario recepcionEn(LocalDateTime momento) {
            List<TurnoPersonal> delDia = turnosPorDia.getOrDefault(momento.toLocalDate(), List.of());
            List<Usuario> enRecepcion = new ArrayList<>();
            Usuario encargadaPresente = null;
            for (TurnoPersonal t : delDia) {
                LocalDateTime fin = t.getSalida() != null ? t.getSalida() : t.getEntrada().plusHours(9);
                if (t.getEntrada().isAfter(momento) || !fin.isAfter(momento)) {
                    continue;
                }
                if (t.getUsuario().getRol() == Rol.RECEPCION) {
                    enRecepcion.add(t.getUsuario());
                } else if (t.getUsuario() == encargada.usuario()) {
                    encargadaPresente = t.getUsuario();
                }
            }
            if (!enRecepcion.isEmpty()) {
                return enRecepcion.get(azar.nextInt(enRecepcion.size()));
            }
            return encargadaPresente != null ? encargadaPresente : dueno;
        }

        // ---------- Socios ----------

        private void crearSocios() {
            List<LocalDate> altas = diasDeAlta();
            Socio anterior = null;
            for (int i = 0; i < SOCIOS_TOTALES; i++) {
                Socio s = nuevoSocio(i, altas.get(i), anterior);
                socios.add(s);
                anterior = s;
            }
            planificarCongelamientos();
            // Uno trajo un certificado falso: se rechazó al día siguiente y a los pocos días trajo uno válido
            Socio conFalso = socios.get(entre(42, 70));
            Apto falso = conFalso.aptos.get(0);
            falso.rechazadoDesde = conFalso.diaAlta().plusDays(1);
            falso.medico = "Dr. Ricardo Gómez - Medicina general - M.P. 99999";
            falso.certificado.setEstadoLegal(EstadoLegalCertificado.RECHAZADO);
            falso.certificado.setMotivoRechazo("El médico no figura en el registro de matriculados y el sello no coincide: se le pidió uno nuevo");
            falso.certificado.setRevisadoPor(encargada.usuario());
            falso.certificado.setFechaRevision(falso.rechazadoDesde.atTime(entre(10, 12), entre(0, 59)));
            falso.certificado.setResumenIa(null);
            conFalso.renovacionApto = conFalso.diaAlta().plusDays(entre(2, 4));
        }

        // 30 la primera semana (la inauguración) y los otros 50 repartidos sin parejo en los meses siguientes
        private List<LocalDate> diasDeAlta() {
            List<LocalDate> dias = new ArrayList<>();
            for (int i = 0; i < 11; i++) {
                dias.add(apertura);
            }
            List<LocalDate> primeraSemana = diasAbiertos(apertura.plusDays(1), apertura.plusDays(7));
            for (int i = dias.size(); i < SOCIOS_INICIALES; i++) {
                // Más al principio: el entusiasmo de la inauguración se va apagando en la semana
                dias.add(primeraSemana.get((int) (Math.pow(azar.nextDouble(), 1.6) * primeraSemana.size())));
            }
            double[] pesos = {1.3, 0.95, 0.65, 1.25, 1.0};
            double suma = 0;
            for (int k = 0; k < pesos.length; k++) {
                pesos[k] *= 0.7 + azar.nextDouble() * 0.6;
                suma += pesos[k];
            }
            int restantes = SOCIOS_TOTALES - SOCIOS_INICIALES;
            int[] cantidades = new int[MESES_CRECIMIENTO];
            int asignados = 0;
            for (int k = 0; k < MESES_CRECIMIENTO; k++) {
                cantidades[k] = (int) Math.floor(restantes * pesos[k] / suma);
                asignados += cantidades[k];
            }
            for (int k = 0; asignados < restantes; k = (k + 1) % MESES_CRECIMIENTO) {
                cantidades[k]++;
                asignados++;
            }
            for (int k = 0; k < MESES_CRECIMIENTO; k++) {
                LocalDate desde = k == 0 ? apertura.plusDays(8) : apertura.plusMonths(k);
                List<LocalDate> candidatos = diasAbiertos(desde, apertura.plusMonths(k + 1).minusDays(1));
                double[] pesoDia = candidatos.stream()
                        .mapToDouble(d -> d.getDayOfWeek() == DayOfWeek.MONDAY ? 1.5
                                : d.getDayOfWeek() == DayOfWeek.SATURDAY ? 0.6 : 1.0)
                        .toArray();
                for (int i = 0; i < cantidades[k]; i++) {
                    dias.add(candidatos.get(ponderado(pesoDia)));
                }
            }
            dias.sort(Comparator.naturalOrder());
            return dias;
        }

        private Socio nuevoSocio(int indice, LocalDate diaAlta, Socio anterior) {
            Socio s = new Socio();
            double r = azar.nextDouble();
            String genero = r < 0.53 ? "Masculino" : r < 0.955 ? "Femenino" : r < 0.97 ? "No binario"
                    : r < 0.985 ? "Prefiero no decirlo" : null;
            s.edad = edad();
            s.tipo = s.edad <= 24 && probabilidad(0.7) ? Perfil.ESTUDIANTE
                    : s.edad >= 62 && probabilidad(0.75) ? Perfil.JUBILADO : Perfil.TRABAJADOR;
            LocalDate nacimiento = hoy.minusYears(s.edad).minusDays(entre(1, 364));

            // A veces se anota un familiar del anterior (mismo apellido y domicilio): los dos con el descuento familiar
            boolean familia = anterior != null && indice >= 2 && probabilidad(0.1)
                    && ChronoUnit.DAYS.between(anterior.diaAlta(), diaAlta) <= 10 && anterior.metodo != MetodoPago.DEBITO_AUTOMATICO;
            String nombreAnterior = familia ? anterior.usuario.getNombreCompleto() : null;
            String apellido = familia ? nombreAnterior.substring(nombreAnterior.lastIndexOf(' ') + 1)
                    : APELLIDOS[azar.nextInt(APELLIDOS.length)];
            String nombre = nombreUnico(genero, apellido);

            s.plan = elegirPlan(s);
            s.metodo = familia ? anterior.metodo : elegirMetodo(s.edad);
            s.frecuencia = frecuencia(s);
            s.puntualidad = s.tipo == Perfil.JUBILADO ? (probabilidad(0.85) ? 0 : 1)
                    : (r = azar.nextDouble()) < 0.6 ? 0 : r < 0.88 ? 1 : 2;
            s.diasDeMargen = margenDePago(s.puntualidad);
            s.riesgo = 0.05 + (s.frecuencia < 2 ? 0.05 : 0) + (s.tipo == Perfil.ESTUDIANTE ? 0.03 : 0) + azar.nextDouble() * 0.04;
            horarios(s);

            if (familia) {
                s.descuento = familiar;
                if (anterior.descuento == null && anterior.especialMotivo == null) {
                    anterior.descuento = familiar;
                    anterior.perfil.setDescuento(familiar);
                }
            } else if (s.metodo != MetodoPago.DEBITO_AUTOMATICO) {
                if (s.tipo == Perfil.ESTUDIANTE && probabilidad(0.35)) {
                    s.descuento = estudiante;
                } else if (s.tipo == Perfil.JUBILADO && probabilidad(0.6)) {
                    s.descuento = jubilado;
                } else if (indice == 3) {
                    s.especialMotivo = "socio fundador";
                    s.especialMonto = new BigDecimal("2500.00");
                } else if (indice > SOCIOS_INICIALES && probabilidad(0.025)) {
                    s.especialMotivo = "canje con el local de suplementos";
                    s.especialMonto = new BigDecimal("5000.00");
                }
            }

            LocalTime horaAlta = diaAlta.equals(apertura)
                    ? aHora(abre(diaAlta) + 0.5 + azar.nextDouble() * (cierra(diaAlta) - abre(diaAlta) - 1.5), diaAlta)
                    : aHora(horaHabitual(s, diaAlta), diaAlta);
            s.alta = diaAlta.atTime(horaAlta).plusSeconds(entre(0, 59));

            String email = email(nombre, nacimiento.getYear());
            s.usuario = usuarioRepository.save(Usuario.builder()
                    .dni(dni(nacimiento.getYear()))
                    .nombreCompleto(nombre)
                    .email(email)
                    .password(hash)
                    .telefono(familia && probabilidad(0.3) ? anterior.usuario.getTelefono() : telefono())
                    .rol(Rol.SOCIO)
                    .estado(EstadoUsuario.ACTIVO)
                    .debeCambiarPassword(false)
                    .build());
            s.usuario.setFechaCreacion(s.alta);

            String ciudad = familia ? anterior.perfil.getCiudad() : ciudad();
            s.perfil = perfilSocioRepository.save(PerfilSocio.builder()
                    .usuario(s.usuario)
                    .fechaNacimiento(nacimiento)
                    .genero(genero)
                    .domicilio(familia ? anterior.perfil.getDomicilio() : domicilio())
                    .ciudad(ciudad)
                    .objetivo(probabilidad(0.85) ? OBJETIVOS[azar.nextInt(OBJETIVOS.length)] : null)
                    .observaciones(indice < 11 && probabilidad(0.5) ? "Socio fundador: se anotó el día de la inauguración."
                            : probabilidad(0.12) ? OBSERVACIONES[azar.nextInt(OBSERVACIONES.length)] : null)
                    .descuento(s.descuento)
                    .build());

            s.patologias = patologias(s.edad);
            int antiguedad = (r = azar.nextDouble()) < 0.68 ? entre(0, 14) : r < 0.85 ? entre(15, 90) : entre(170, 330);
            agregarApto(s, diaAlta.minusDays(antiguedad), diaAlta);
            return s;
        }

        private int edad() {
            int[][] rangos = {{16, 17}, {18, 25}, {26, 35}, {36, 45}, {46, 55}, {56, 71}};
            int rango = ponderado(new double[]{4, 31, 29, 18, 10, 8});
            return entre(rangos[rango][0], rangos[rango][1]);
        }

        private Plan elegirPlan(Socio s) {
            Plan corredor = planes.values().stream()
                    .filter(p -> Boolean.TRUE.equals(p.getActivo()) && !Set.of("Pase Libre", "3 veces por semana", "2 veces por semana").contains(p.getNombrePlan()))
                    .findFirst().orElse(null);
            double pesoCorredor = corredor == null ? 0 : (s.edad >= 22 && s.edad <= 50 ? 9 : 2);
            Plan[] opciones = {planes.get("Pase Libre"), planes.get("3 veces por semana"), planes.get("2 veces por semana"), corredor};
            double[] pesos = s.tipo == Perfil.JUBILADO ? new double[]{18, 30, 45, pesoCorredor / 3}
                    : s.tipo == Perfil.ESTUDIANTE ? new double[]{50, 28, 16, pesoCorredor / 2}
                    : new double[]{41, 31, 19, pesoCorredor};
            // Un plan desactivado no se le ofrece a nadie
            for (int i = 0; i < 3; i++) {
                if (!Boolean.TRUE.equals(opciones[i].getActivo())) {
                    pesos[i] = 0;
                }
            }
            return opciones[ponderado(pesos)];
        }

        private MetodoPago elegirMetodo(int edad) {
            MetodoPago[] metodos = {MetodoPago.EFECTIVO, MetodoPago.TRANSFERENCIA, MetodoPago.MERCADO_PAGO,
                    MetodoPago.TARJETA_DEBITO, MetodoPago.TARJETA_CREDITO, MetodoPago.DEBITO_AUTOMATICO};
            double[] pesos = edad < 30 ? new double[]{17, 30, 30, 9, 4, 12}
                    : edad < 55 ? new double[]{24, 26, 15, 12, 8, 17}
                    : new double[]{45, 17, 6, 20, 8, 5};
            return metodos[ponderado(pesos)];
        }

        private double frecuencia(Socio s) {
            Integer veces = s.plan.getVecesPorSemana();
            double base = veces == null ? 2.0 + Math.pow(azar.nextDouble(), 1.2) * 3.4
                    : veces >= 3 ? 2.2 + azar.nextDouble() * 1.0
                    : 1.5 + azar.nextDouble() * 0.6;
            return s.tipo == Perfil.JUBILADO ? base + 0.3 : base;
        }

        private int margenDePago(int puntualidad) {
            int tipo = probabilidad(0.15) ? azar.nextInt(3) : puntualidad;
            return switch (tipo) {
                case 0 -> -entre(0, 4);
                case 1 -> entre(-1, 3);
                default -> entre(4, 12);
            };
        }

        // Hora habitual de cada socio según lo que hace, y qué días prefiere
        private void horarios(Socio s) {
            double[] horas;
            double[] pesos;
            switch (s.tipo) {
                case ESTUDIANTE -> {
                    horas = new double[]{9.5, 11.0, 14.8, 16.2, 17.5, 19.0, 20.5};
                    pesos = new double[]{1, 1.2, 1.6, 2, 2.2, 1.8, 1};
                }
                case JUBILADO -> {
                    horas = new double[]{8.5, 9.5, 10.5, 15.5, 17.0};
                    pesos = new double[]{1.5, 2.5, 2, 1, 0.6};
                }
                default -> {
                    horas = new double[]{7.4, 8.4, 12.9, 17.8, 18.8, 19.8, 20.9};
                    pesos = new double[]{2.0, 1.3, 1.2, 1.9, 2.7, 2.6, 1.3};
                }
            }
            s.hora = horas[ponderado(pesos)] + (azar.nextDouble() - 0.5) * 0.8;
            // En los días cortos (el sábado): en qué parte del horario suele venir, de 0 (al abrir) a 1 (al cerrar)
            s.franjaDiaCorto = probabilidad(0.2) ? 0.6 + azar.nextDouble() * 0.4 : 0.05 + azar.nextDouble() * 0.6;
            double[] base = {1.25, 1.1, 1.18, 1.05, 0.8, 0.5, 0};
            double r = azar.nextDouble();
            for (int dia = 0; dia < 7; dia++) {
                s.pesosDias[dia] = base[dia] * (0.55 + azar.nextDouble() * 0.9);
            }
            if (r < 0.35) { // lunes, miércoles y viernes
                s.pesosDias[0] *= 1.6;
                s.pesosDias[2] *= 1.6;
                s.pesosDias[4] *= 1.6;
            } else if (r < 0.6) { // martes y jueves
                s.pesosDias[1] *= 1.7;
                s.pesosDias[3] *= 1.7;
            }
            if (probabilidad(0.15)) {
                s.pesosDias[5] *= 2.5;
            }
        }

        private String patologias(int edad) {
            double probabilidad = edad >= 45 ? 0.68 : edad >= 30 ? 0.45 : 0.32;
            if (!probabilidad(probabilidad)) {
                return null;
            }
            double r = azar.nextDouble();
            int cantidad = r < 0.7 ? 1 : r < 0.94 ? 2 : 3;
            double mayor = Math.min(1, Math.max(0, (edad - 25) / 35.0));
            double[] pesos = PATOLOGIAS.stream().mapToDouble(p -> p.pesoJoven() * (1 - mayor) + p.pesoMayor() * mayor).toArray();
            Set<String> elegidas = new LinkedHashSet<>();
            while (elegidas.size() < cantidad) {
                elegidas.add(PATOLOGIAS.get(ponderado(pesos)).texto());
            }
            return String.join(", ", elegidas);
        }

        private void agregarApto(Socio s, LocalDate emision, LocalDate carga) {
            Apto apto = new Apto();
            apto.carga = carga;
            apto.medico = MEDICOS[azar.nextInt(MEDICOS.length)];
            boolean leidoPorIa = probabilidad(0.72);
            apto.certificado = CertificadoMedico.builder()
                    .usuario(s.usuario)
                    .fechaEmision(emision)
                    .fechaVencimiento(emision.plusDays(365))
                    .estadoLegal(EstadoLegalCertificado.VIGENTE)
                    .observacionesPatologias(s.patologias)
                    .resumenIa(leidoPorIa ? resumenIa(s.patologias) : null)
                    .build();
            s.aptos.add(apto);
            // Si vence antes de hoy, lo renueva cerca del vencimiento (o todavía no lo trajo)
            LocalDate vence = emision.plusDays(365);
            LocalDate renovacion = vence.plusDays(entre(-12, 20));
            s.renovacionApto = !vence.isAfter(hoy) && !renovacion.isAfter(hoy) && renovacion.isAfter(carga) ? renovacion : null;
        }

        private String resumenIa(String patologias) {
            if (patologias == null) {
                return "Apto para realizar actividad física sin restricciones.";
            }
            StringBuilder resumen = new StringBuilder("Apto para la actividad física con indicaciones.");
            for (String texto : patologias.split(", ")) {
                PATOLOGIAS.stream().filter(p -> p.texto().equals(texto)).findFirst()
                        .ifPresent(p -> resumen.append(' ').append(p.indicacion()));
            }
            return resumen.length() > 1000 ? resumen.substring(0, 1000) : resumen.toString();
        }

        private void planificarCongelamientos() {
            LocalDate receso = fechaDelAnio(7, 13);
            String[] vacaciones = {"Vacaciones de invierno en familia", "Viaje a Bariloche con los chicos", "Viaje a visitar a la familia en Córdoba"};
            for (String observacion : vacaciones) {
                planificarCongelamiento(receso.plusDays(entre(0, 6)), entre(8, 14), MotivoCongelamiento.VACACIONES, observacion);
            }
            planificarCongelamiento(apertura.plusDays(entre(100, 135)), entre(18, 26), MotivoCongelamiento.SALUD,
                    "Esguince de tobillo: reposo indicado por el traumatólogo");
            planificarCongelamiento(apertura.plusDays(entre(140, 160)), 14, MotivoCongelamiento.OTRO,
                    "Viaje de trabajo a Vaca Muerta (diagrama 14x14)");
            // Uno en curso hoy
            planificarCongelamiento(hoy.minusDays(entre(4, 8)), entre(16, 21), MotivoCongelamiento.SALUD,
                    "Cirugía programada: vuelve con el alta médica");
        }

        private void planificarCongelamiento(LocalDate desde, int dias, MotivoCongelamiento motivo, String observacion) {
            if (!desde.isBefore(apertura.plusDays(25)) && !desde.isAfter(hoy)) {
                porCongelar.add(new Congelar(desde, dias, motivo, observacion));
            }
        }

        // ---------- Día por día ----------

        private void simular() {
            for (LocalDate d = apertura; !d.isAfter(hoy); d = d.plusDays(1)) {
                boolean abierto = !cerrado(d);
                for (Congelar congelar : porCongelar) {
                    if (congelar.desde().equals(d)) {
                        congelar(congelar, d);
                    }
                }
                for (Socio s : socios) {
                    if (d.isBefore(s.diaAlta())) {
                        continue;
                    }
                    if (d.equals(s.renovacionApto)) {
                        renovarApto(s, d);
                    }
                    cobroAutomatico(s, d);
                    confirmarBaja(s, d);
                    if (!abierto) {
                        continue;
                    }
                    if (d.equals(s.diaAlta())) {
                        inscripcion(s);
                        continue;
                    }
                    cancelarDebito(s, d);
                    if (d.getDayOfWeek() == DayOfWeek.MONDAY) {
                        planificarSemana(s, d);
                    }
                    if (s.baja) {
                        if (d.equals(s.vuelve)) {
                            volver(s, d);
                        }
                        continue;
                    }
                    if (s.semana.contains(d) || d.equals(s.diaExtra)) {
                        visita(s, d, d.equals(s.diaExtra));
                    }
                }
            }
        }

        private void inscripcion(Socio s) {
            pagar(s, s.alta.plusMinutes(entre(1, 4)), true);
            if (probabilidad(0.82)) {
                entrar(s, s.alta.plusMinutes(entre(6, 15)), false);
            }
            if (s.diaAlta().getDayOfWeek() != DayOfWeek.SATURDAY) {
                planificarSemana(s, s.diaAlta().plusDays(1));
            }
        }

        private void visita(Socio s, LocalDate d, boolean extra) {
            LocalDateTime t = horaDeVisita(s, d);
            if (t.isAfter(ahora) || congelado(s, d)) {
                return;
            }
            if (!aptoVigente(s, d)) {
                rechazoPorApto(s, d, t);
                return;
            }
            LocalDate vence = s.vence();
            boolean enGracia = !d.isAfter(vence.plusDays(acceso.getDiasGraciaMembresia()));
            if (s.seVa) {
                // Ya decidió no renovar: viene cada vez menos y deja de venir cuando se le corta el acceso
                if (enGracia && probabilidad(0.55)) {
                    entrar(s, t, extra);
                }
                return;
            }
            boolean debePagar = !s.debitoActivo() && !s.pagoPendiente && !d.isBefore(vence.plusDays(s.diasDeMargen));
            // t es cuando llega (siempre con el gimnasio abierto): lo que hace en recepción va después
            if (enGracia) {
                if (debePagar) {
                    pagar(s, t, false);
                    t = t.plusMinutes(entre(2, 5));
                }
                entrar(s, t, extra);
            } else if (debePagar) {
                if (probabilidad(0.4)) {
                    log(s.usuario, t, TipoEventoAsistencia.INGRESO_MOLINETE, ResultadoAsistencia.DENEGADO_CUOTA_VENCIDA);
                    t = t.plusMinutes(1);
                }
                pagar(s, t, false);
                entrar(s, t.plusMinutes(entre(2, 5)), extra);
            } else if (probabilidad(0.3)) {
                // Viene sin haber pagado: el molinete no lo deja pasar
                log(s.usuario, t, TipoEventoAsistencia.INGRESO_MOLINETE, ResultadoAsistencia.DENEGADO_CUOTA_VENCIDA);
                double r = azar.nextDouble();
                if (r < 0.5) {
                    pagar(s, t.plusMinutes(2), false);
                    entrar(s, t.plusMinutes(entre(3, 5)), extra);
                } else if (r < 0.75 && s.excepciones < 2) {
                    s.excepciones++;
                    excepcion(s, t.plusMinutes(1), elegir("Paga mañana: se olvidó la billetera",
                            "Hizo la transferencia y todavía no se ve acreditada", "Viene a pagar a la salida",
                            "Socio de siempre: paga el lunes", "No le funciona la app del banco"));
                    // Paga en la próxima visita
                    s.diasDeMargen = (int) ChronoUnit.DAYS.between(vence, d) + 1;
                }
            }
        }

        // Registra el ingreso si el plan todavía tiene días esta semana
        private void entrar(Socio s, LocalDateTime t, boolean extra) {
            if (t.isAfter(ahora)) {
                return;
            }
            LocalDate d = t.toLocalDate();
            Integer limite = s.suscripcion != null ? s.suscripcion.getPlan().getVecesPorSemana() : null;
            LocalDate lunes = d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            long usados = s.diasConIngreso.subSet(lunes, d).size();
            if (limite != null && acceso.isRequerirMembresiaActiva() && !s.diasConIngreso.contains(d) && usados >= limite) {
                log(s.usuario, t, TipoEventoAsistencia.INGRESO_MOLINETE, ResultadoAsistencia.DENEGADO_LIMITE_SEMANAL);
                if (probabilidad(extra ? 0.18 : 0.1)) {
                    excepcion(s, t.plusMinutes(1), elegir("Recupera el día que faltó la semana pasada",
                            "Cambia el día del viernes: no va a poder venir", "Viene a una evaluación con el profesor"));
                }
                return;
            }
            log(s.usuario, t, TipoEventoAsistencia.INGRESO_MOLINETE, ResultadoAsistencia.PERMITIDO);
            s.diasConIngreso.add(d);
        }

        private void excepcion(Socio s, LocalDateTime t, String motivo) {
            LogAsistencia excepcion = log(s.usuario, t, TipoEventoAsistencia.INGRESO_EXCEPCION, ResultadoAsistencia.PERMITIDO);
            excepcion.setAutorizadoPor(recepcionEn(t));
            excepcion.setMotivoExcepcion(motivo);
            s.diasConIngreso.add(t.toLocalDate());
        }

        private void rechazoPorApto(Socio s, LocalDate d, LocalDateTime t) {
            if (s.ultimoRechazoApto != null && !d.isAfter(s.ultimoRechazoApto.plusDays(5))) {
                return;
            }
            log(s.usuario, t, TipoEventoAsistencia.INGRESO_MOLINETE, ResultadoAsistencia.DENEGADO_CERTIFICADO_MEDICO);
            s.ultimoRechazoApto = d;
            // Le avisan en recepción y casi siempre lo trae en los días siguientes
            if (s.renovacionApto == null && probabilidad(0.55)) {
                LocalDate renovacion = d.plusDays(entre(1, 6));
                s.renovacionApto = renovacion.isAfter(hoy) ? null : renovacion;
            }
        }

        private void renovarApto(Socio s, LocalDate d) {
            s.renovacionApto = null;
            if (s.baja) {
                return;
            }
            // El médico puede encontrar algo nuevo (o ya no anotar lo que tenía)
            if (probabilidad(0.15)) {
                s.patologias = patologias(s.edad);
            }
            agregarApto(s, d.minusDays(entre(0, 6)), d);
        }

        private boolean aptoVigente(Socio s, LocalDate d) {
            if (!acceso.isRequerirCertificadoMedico()) {
                return true;
            }
            for (Apto apto : s.aptos) {
                CertificadoMedico c = apto.certificado;
                if (!apto.carga.isAfter(d) && (apto.rechazadoDesde == null || d.isBefore(apto.rechazadoDesde))
                        && !d.isAfter(c.getFechaVencimiento().plusDays(acceso.getDiasGraciaCertificado()))) {
                    return true;
                }
            }
            return false;
        }

        private void confirmarBaja(Socio s, LocalDate d) {
            if (!s.seVa || s.baja || s.vence() == null || !d.isAfter(s.vence().plusDays(acceso.getDiasGraciaMembresia()))) {
                return;
            }
            s.baja = true;
            s.semana.clear();
            s.diaExtra = null;
            // Algunos vuelven después de un tiempo (con matrícula, si pasaron más días que los de la regla)
            if (probabilidad(0.22)) {
                LocalDate vuelve = proximoDiaAbierto(s.vence().plusDays(entre(25, 80)));
                s.vuelve = vuelve.isAfter(hoy) ? null : vuelve;
            }
        }

        private void volver(Socio s, LocalDate d) {
            LocalDateTime t = horaDeVisita(s, d);
            if (t.isAfter(ahora)) {
                return;
            }
            s.baja = false;
            s.seVa = false;
            s.vuelve = null;
            s.compromiso = 1.05;
            s.excepciones = 0;
            if (!aptoVigente(s, d)) {
                agregarApto(s, d.minusDays(entre(0, 10)), d);
            }
            pagar(s, t, false);
            entrar(s, t.plusMinutes(entre(3, 8)), false);
            if (d.getDayOfWeek() != DayOfWeek.SATURDAY) {
                planificarSemana(s, d.plusDays(1));
            }
        }

        // Lo pide un socio con la membresía vigente ese día (como exige CongelamientoService), sin débito automático
        private void congelar(Congelar congelar, LocalDate d) {
            List<Socio> candidatos = socios.stream()
                    .filter(s -> s.congelamiento == null && !s.baja && !s.seVa && s.debito == null && s.suscripcion != null
                            && !s.vence().isBefore(d) && s.diaAlta().isBefore(d.minusDays(20)))
                    .toList();
            if (candidatos.isEmpty()) {
                return;
            }
            Socio s = candidatos.get(azar.nextInt(candidatos.size()));
            LocalDate hasta = d.plusDays(congelar.dias() - 1);
            s.suscripcion.setFechaVencimiento(s.vence().plusDays(congelar.dias()));
            LocalDate diaRegistro = d.minusDays(entre(0, 2));
            while (cerrado(diaRegistro)) {
                diaRegistro = diaRegistro.minusDays(1);
            }
            LocalDateTime registro = diaRegistro.atTime(aHora(abre(diaRegistro) + 1 + azar.nextDouble()
                    * Math.max(0.5, cierra(diaRegistro) - abre(diaRegistro) - 2), diaRegistro));
            if (registro.isAfter(ahora)) {
                registro = ahora.minusMinutes(entre(30, 120));
            }
            s.congelamiento = Congelamiento.builder()
                    .usuario(s.usuario)
                    .suscripcion(s.suscripcion)
                    .desde(d)
                    .hasta(hasta)
                    .motivo(congelar.motivo())
                    .observacion(congelar.observacion())
                    .diasAplicados(congelar.dias())
                    .terminadoAntes(false)
                    .anulado(false)
                    .registradoPor(recepcionEn(registro))
                    .fechaRegistro(registro)
                    .build();
            congelamientos.add(s.congelamiento);
        }

        private boolean congelado(Socio s, LocalDate d) {
            return s.congelamiento != null && !d.isBefore(s.congelamiento.getDesde()) && !d.isAfter(s.congelamiento.getHasta());
        }

        // ---------- Semana y horarios ----------

        // Qué días viene esta semana: según su frecuencia, su compromiso del momento y los días que prefiere
        private void planificarSemana(Socio s, LocalDate desde) {
            s.semana.clear();
            s.diaExtra = null;
            List<LocalDate> candidatos = diasAbiertos(desde, desde.with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY)));
            if (candidatos.isEmpty() || s.baja) {
                return;
            }
            double factor = s.compromiso * (s.seVa ? 0.6 : 1);
            if (enRecesoInvernal(desde)) {
                factor *= s.tipo == Perfil.ESTUDIANTE ? 0.45 : 0.85;
            }
            int k = (int) Math.round(s.frecuencia * factor * candidatos.size() / 6.0 + azar.nextGaussian() * 0.7);
            if (probabilidad(0.06)) {
                k = 0; // una semana que no vino (viaje, enfermedad, trabajo)
            }
            k = Math.max(0, Math.min(k, candidatos.size()));
            Integer limite = s.suscripcion != null ? s.suscripcion.getPlan().getVecesPorSemana() : s.plan.getVecesPorSemana();
            boolean extra = false;
            if (limite != null && k > limite) {
                extra = probabilidad(0.15);
                k = limite;
            }
            List<LocalDate> disponibles = new ArrayList<>(candidatos);
            for (int i = 0; i < k; i++) {
                double[] pesos = disponibles.stream()
                        .mapToDouble(d -> s.pesosDias[d.getDayOfWeek().getValue() - 1] * (FERIADOS.contains(MonthDay.from(d)) ? 0.55 : 1))
                        .toArray();
                s.semana.add(disponibles.remove(ponderado(pesos)));
            }
            if (extra) {
                LocalDate ultimo = s.semana.stream().max(Comparator.naturalOrder()).orElse(desde);
                disponibles.stream().filter(d -> d.isAfter(ultimo)).findFirst().ifPresent(d -> s.diaExtra = d);
            }
            s.compromiso = Math.max(0.55, Math.min(1.2, s.compromiso + azar.nextGaussian() * 0.05));
        }

        private LocalDateTime horaDeVisita(Socio s, LocalDate d) {
            double hora = horaHabitual(s, d);
            if (!diaCorto(d) && probabilidad(0.12)) {
                hora = elegir(7.3, 9.5, 13.0, 17.5, 19.5, 21.0); // un día que viene a otra hora
            }
            hora += azar.nextGaussian() * 0.45;
            return d.atTime(aHora(hora, d)).plusSeconds(entre(0, 59));
        }

        // A qué hora suele venir ese día: la de siempre, o su parte del horario en los días cortos
        private double horaHabitual(Socio s, LocalDate d) {
            return diaCorto(d) ? abre(d) + s.franjaDiaCorto * (cierra(d) - abre(d) - 0.7) : s.hora;
        }

        // Una hora dentro del horario del gimnasio (entra hasta 40 minutos antes del cierre). La que cae afuera se acerca
        // a la apertura o al cierre, repartida, para que no se amontonen todos en el mismo minuto
        private LocalTime aHora(double hora, LocalDate d) {
            double desde = abre(d) + 0.02;
            double hasta = cierra(d) - 0.65;
            if (hora < desde) {
                hora = desde + azar.nextDouble() * Math.min(0.9, hasta - desde);
            } else if (hora > hasta) {
                hora = hasta - azar.nextDouble() * Math.min(1.2, hasta - desde);
            }
            return LocalTime.ofSecondOfDay((long) (Math.max(desde, Math.min(hasta, hora)) * 3600));
        }

        // ---------- Cobros ----------

        private void pagar(Socio s, LocalDateTime t, boolean inscripcion) {
            LocalDate d = t.toLocalDate();
            if (s.planSiguiente != null) {
                s.plan = s.planSiguiente;
                s.planSiguiente = null;
            }
            Plan plan = s.plan;
            BigDecimal precio = precio(plan, d);
            String descuentoNombre = null;
            BigDecimal descuentoMonto = null;
            if (s.descuento != null) {
                descuentoNombre = s.descuento.getNombre();
                descuentoMonto = DescuentoService.montoSobre(s.descuento, precio);
            } else if (s.especialMotivo != null) {
                descuentoNombre = "Especial: " + s.especialMotivo;
                descuentoMonto = s.especialMonto.min(precio);
            }
            BigDecimal matricula = null;
            LocalDate ultimoVencimiento = s.vence();
            boolean correspondeMatricula = reglas.getMatriculaMonto().signum() > 0 && (ultimoVencimiento == null
                    || (reglas.getMatriculaReinscripcionDias() > 0
                    && ChronoUnit.DAYS.between(ultimoVencimiento, d) > reglas.getMatriculaReinscripcionDias()));
            if (correspondeMatricula) {
                // La semana de la inauguración no se cobró matrícula
                boolean bonificada = d.isBefore(apertura.plusDays(7)) || probabilidad(0.08);
                matricula = bonificada ? BigDecimal.ZERO.setScale(2) : reglas.getMatriculaMonto().setScale(2, RoundingMode.HALF_UP);
            }
            BigDecimal total = precio.subtract(descuentoMonto != null ? descuentoMonto : BigDecimal.ZERO)
                    .add(matricula != null ? matricula : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);

            MetodoPago metodo = metodoDelCobro(s);
            Usuario cajero = recepcionEn(t);
            EstadoPago estado = EstadoPago.APROBADO;
            Usuario verificador = null;
            LocalDateTime verificacion = null;
            if (VERIFICABLES.contains(metodo) && !inscripcion) {
                // Uno de estos últimos días: recepción lo dejó pasar y el admin todavía no lo revisó
                if (d.isAfter(hoy.minusDays(4)) && pendientes < 3 && probabilidad(0.7)) {
                    // Quedó a verificar y el admin todavía no lo revisó
                    estado = EstadoPago.PENDIENTE;
                    pendientes++;
                    s.pagoPendiente = true;
                } else if (rechazados < 3 && d.isBefore(hoy.minusDays(10)) && probabilidad(0.015)) {
                    // La transferencia nunca se acreditó: el admin la rechazó y el socio pagó en efectivo la vez siguiente
                    estado = EstadoPago.RECHAZADO;
                    rechazados++;
                    verificador = encargada.usuario();
                    verificacion = proximoDiaHabil(d.plusDays(1)).atTime(entre(10, 12), entre(0, 59));
                    s.pagaEnEfectivo = true;
                } else if (t.isBefore(ahora.minusHours(30)) && probabilidad(0.07)) {
                    verificador = probabilidad(0.8) ? encargada.usuario() : dueno;
                    verificacion = t.plusHours(entre(2, 26)).plusMinutes(entre(0, 59));
                }
            }
            PagoHistorial pago = PagoHistorial.builder()
                    .usuario(s.usuario)
                    .plan(plan)
                    .montoAbonado(total)
                    .fechaPago(t)
                    .metodoPago(metodo)
                    .comprobanteNro(comprobante(metodo))
                    .estadoPago(estado)
                    .registradoPor(cajero)
                    .verificadoPor(verificador)
                    .fechaVerificacion(verificacion)
                    .precioLista(precio)
                    .descuentoNombre(descuentoNombre)
                    .descuentoMonto(descuentoMonto)
                    .matriculaMonto(matricula)
                    .build();
            pagos.add(pago);
            if (estado != EstadoPago.APROBADO) {
                return;
            }
            if (metodo == MetodoPago.EFECTIVO) {
                s.pagaEnEfectivo = false;
            }
            pago.setVenceMembresia(extender(s, plan, d));
            // Los que eligen débito automático se adhieren en recepción después de alguno de sus primeros cobros
            if (s.metodo == MetodoPago.DEBITO_AUTOMATICO && s.debito == null && !s.seVa && probabilidad(0.85)) {
                adherirDebito(s, plan, t.plusMinutes(entre(2, 5)), cajero);
            }
        }

        private void cobroAutomatico(Socio s, LocalDate d) {
            if (!s.debitoActivo() || s.seVa || !d.equals(s.vence())) {
                return;
            }
            LocalDateTime t = d.atTime(entre(5, 10), entre(0, 59), entre(0, 59));
            if (t.isAfter(ahora)) {
                return;
            }
            BigDecimal monto = precio(s.debito.getPlan(), d);
            String idMercadoPago = "demo-" + (operacion++);
            pagos.add(PagoHistorial.builder()
                    .usuario(s.usuario)
                    .plan(s.debito.getPlan())
                    .montoAbonado(monto)
                    .fechaPago(t)
                    .metodoPago(MetodoPago.DEBITO_AUTOMATICO)
                    .comprobanteNro("MP " + idMercadoPago)
                    .estadoPago(EstadoPago.APROBADO)
                    .mpPaymentId(idMercadoPago)
                    .venceMembresia(extender(s, s.debito.getPlan(), d))
                    .build());
            s.debito.setMonto(monto);
            s.debito.setUltimoCobro(t);
        }

        private void adherirDebito(Socio s, Plan plan, LocalDateTime t, Usuario cajero) {
            s.debito = DebitoAutomatico.builder()
                    .usuario(s.usuario)
                    .plan(plan)
                    .monto(precio(plan, t.toLocalDate()))
                    .estado(EstadoDebito.ACTIVO)
                    .mpPreapprovalId("demo-" + UUID.randomUUID())
                    .emailPagador(s.usuario.getEmail())
                    .medioPago(elegir("visa", "master", "debvisa", "debmaster", "account_money"))
                    .fechaAlta(t)
                    .creadoPor(cajero)
                    .build();
            debitos.add(s.debito);
        }

        // El que se va y tenía débito lo da de baja en recepción unos días antes del vencimiento
        private void cancelarDebito(Socio s, LocalDate d) {
            if (!s.debitoActivo() || !s.seVa || s.vence() == null || d.isBefore(s.vence().minusDays(5))) {
                return;
            }
            LocalDateTime t = horaDeVisita(s, d);
            if (t.isAfter(ahora)) {
                return;
            }
            s.debito.setEstado(EstadoDebito.CANCELADO);
            s.debito.setFechaBaja(t);
            s.debito.setBajaPor(recepcionEn(t));
            s.debito.setProximoCobro(null);
        }

        // Igual que SuscripcionService.extenderOcrearSuscripcion, pero con la fecha del cobro en lugar de hoy
        private LocalDate extender(Socio s, Plan plan, LocalDate d) {
            Suscripcion suscripcion = s.suscripcion;
            if (suscripcion != null && !suscripcion.getFechaVencimiento().isBefore(d)) {
                suscripcion.setPlan(plan);
                suscripcion.setFechaVencimiento(suscripcion.getFechaVencimiento().plusDays(plan.getDuracionDias()));
            } else {
                suscripcion = Suscripcion.builder()
                        .usuario(s.usuario)
                        .plan(plan)
                        .fechaInicio(d)
                        .fechaVencimiento(d.plusDays(plan.getDuracionDias()))
                        .activa(true)
                        .build();
                suscripciones.add(suscripcion);
                s.suscripcion = suscripcion;
            }
            proximoCiclo(s);
            return suscripcion.getFechaVencimiento();
        }

        // Qué va a hacer cuando le vuelva a vencer: renovar a tiempo, tarde, cambiar de plan o irse
        private void proximoCiclo(Socio s) {
            s.ciclos++;
            double riesgo = s.riesgo * (s.ciclos == 1 ? 1.7 : 1) * (s.debitoActivo() ? 0.35 : 1);
            s.seVa = probabilidad(riesgo);
            s.diasDeMargen = margenDePago(s.puntualidad);
            s.pagoPendiente = false;
            if (!s.seVa && s.debito == null && probabilidad(0.06)) {
                s.planSiguiente = cambioDePlan(s.plan);
            }
        }

        private Plan cambioDePlan(Plan actual) {
            Plan libre = planes.get("Pase Libre");
            Plan tres = planes.get("3 veces por semana");
            Plan dos = planes.get("2 veces por semana");
            Plan nuevo = actual == dos ? tres
                    : actual == tres ? (probabilidad(0.65) ? libre : dos)
                    : actual == libre ? tres : libre;
            return Boolean.TRUE.equals(nuevo.getActivo()) ? nuevo : null;
        }

        private MetodoPago metodoDelCobro(Socio s) {
            if (s.pagaEnEfectivo) {
                return MetodoPago.EFECTIVO;
            }
            MetodoPago[] presenciales = {MetodoPago.EFECTIVO, MetodoPago.TRANSFERENCIA, MetodoPago.MERCADO_PAGO,
                    MetodoPago.TARJETA_DEBITO, MetodoPago.TARJETA_CREDITO};
            if (s.metodo == MetodoPago.DEBITO_AUTOMATICO) {
                // Mientras no se adhiere, paga con tarjeta o QR
                return presenciales[2 + ponderado(new double[]{3, 3, 4})];
            }
            if (probabilidad(0.14)) {
                return presenciales[ponderado(new double[]{3, 3, 2.5, 1.2, 0.6})];
            }
            return s.metodo;
        }

        private String comprobante(MetodoPago metodo) {
            return switch (metodo) {
                case TRANSFERENCIA -> probabilidad(0.7) ? "Op. " + entre(10_000_000, 99_999_999) : "";
                case MERCADO_PAGO -> probabilidad(0.6) ? "QR " + (operacion++) : "";
                case TARJETA_DEBITO, TARJETA_CREDITO -> String.format("Lote %03d cupón %04d", entre(1, 40), entre(1, 9999));
                default -> "";
            };
        }

        // Precio de lista de ese día: antes del aumento, un 10 % menos (redondeado a 500)
        private BigDecimal precio(Plan plan, LocalDate d) {
            BigDecimal actual = plan.getPrecioBase().setScale(2, RoundingMode.HALF_UP);
            if (!d.isBefore(aumento)) {
                return actual;
            }
            BigDecimal anterior = actual.multiply(new BigDecimal("0.9"))
                    .divide(new BigDecimal("500"), 0, RoundingMode.HALF_UP).multiply(new BigDecimal("500"));
            return anterior.setScale(2, RoundingMode.HALF_UP);
        }

        // ---------- Gastos ----------

        // Los montos acompañan los precios de los planes, para que las cuentas del gimnasio sean creíbles
        private void generarGastos() {
            Usuario admin = encargada.usuario();
            gasto(proximoDiaHabil(apertura.minusDays(10)).atTime(11, 20), CategoriaGasto.EQUIPAMIENTO,
                    "Discos, barras olímpicas y soportes de sentadilla", 640_000, MetodoPago.TRANSFERENCIA, "Factura B 0003-00001842", admin);
            gasto(proximoDiaHabil(apertura.minusDays(8)).atTime(16, 5), CategoriaGasto.EQUIPAMIENTO,
                    "Mancuernas hexagonales de 2 a 30 kg y kettlebells", 385_000, MetodoPago.TARJETA_CREDITO, null, admin);
            gasto(proximoDiaHabil(apertura.minusDays(6)).atTime(12, 40), CategoriaGasto.EQUIPAMIENTO,
                    "Colchonetas, bandas elásticas y cajones pliométricos", 96_500, MetodoPago.TRANSFERENCIA, null, admin);
            gasto(proximoDiaHabil(apertura.minusDays(5)).atTime(10, 15), CategoriaGasto.ALQUILER,
                    "Depósito en garantía del local", 280_000, MetodoPago.TRANSFERENCIA, null, admin);
            gasto(proximoDiaHabil(apertura.minusDays(4)).atTime(17, 30), CategoriaGasto.OTROS,
                    "Vinilos de la fachada y cartel luminoso", 118_000, MetodoPago.TRANSFERENCIA, null, admin);
            gasto(proximoDiaHabil(apertura.minusDays(3)).atTime(19, 10), CategoriaGasto.OTROS,
                    "Publicidad de la inauguración en Instagram", 25_000, MetodoPago.TARJETA_CREDITO, null, admin);
            Gasto botiquin = gasto(apertura.atTime(9, 40), CategoriaGasto.INSUMOS, "Botiquín de primeros auxilios",
                    27_800, MetodoPago.EFECTIVO, null, admin);
            botiquin.setFueraDeCaja(true); // lo pagó el dueño: la caja todavía no tenía efectivo

            YearMonth primero = YearMonth.from(apertura).plusMonths(1);
            for (YearMonth mes = primero; !mes.isAfter(YearMonth.from(hoy)); mes = mes.plusMonths(1)) {
                YearMonth anterior = mes.minusMonths(1);
                String nombreMes = nombreMes(mes);
                String nombreAnterior = nombreMes(anterior);
                int mesDelAnio = mes.getMonthValue();
                boolean invierno = mesDelAnio >= 6 && mesDelAnio <= 8;

                gastoAdmin(mes, entre(1, 5), CategoriaGasto.ALQUILER, "Alquiler del local - " + nombreMes,
                        mes.atDay(1).isBefore(aumento) ? 280_000 : 310_000, MetodoPago.TRANSFERENCIA);
                gastoAdmin(mes, 8, CategoriaGasto.SERVICIOS, "Internet y teléfono - " + nombreMes, 19_990, MetodoPago.TARJETA_CREDITO);
                gastoAdmin(mes, entre(3, 9), CategoriaGasto.OTROS, "Publicidad en redes sociales - " + nombreMes,
                        redondear(entre(12_000, 25_000), 500), MetodoPago.TARJETA_CREDITO);
                gastoAdmin(mes, entre(10, 15), CategoriaGasto.SERVICIOS, "Luz (EPEN) - " + nombreAnterior,
                        redondear((int) (entre(45_000, 72_000) * (invierno ? 1.2 : 1)), 10), elegir(MetodoPago.TRANSFERENCIA, MetodoPago.MERCADO_PAGO));
                gastoAdmin(mes, entre(17, 22), CategoriaGasto.SERVICIOS, "Gas (Camuzzi) - " + nombreAnterior,
                        redondear(invierno ? entre(45_000, 65_000) : mesDelAnio == 5 || mesDelAnio == 9 ? entre(28_000, 38_000)
                                : entre(15_000, 24_000), 10), MetodoPago.TRANSFERENCIA);
                gastoAdmin(mes, entre(20, 26), CategoriaGasto.SERVICIOS, "Agua (EPAS) - " + nombreAnterior,
                        redondear(entre(9_000, 13_000), 10), MetodoPago.MERCADO_PAGO);
                gastoAdmin(mes, 10, CategoriaGasto.IMPUESTOS, "Tasa municipal de comercio e industria - " + nombreMes,
                        redondear(entre(8_000, 11_000), 10), MetodoPago.TRANSFERENCIA);
                if (!anterior.isBefore(YearMonth.from(apertura).plusMonths(1))) {
                    int brutos = redondear((int) (ingresosDelMes(anterior) * 0.03), 10);
                    gastoAdmin(mes, entre(13, 18), CategoriaGasto.IMPUESTOS, "Ingresos Brutos (anticipo) - " + nombreAnterior,
                            brutos, MetodoPago.TRANSFERENCIA);
                    for (Empleado e : empleados) {
                        sueldo(e, anterior, mes);
                    }
                }

                // Lo chico se paga en efectivo desde la caja de recepción
                for (LocalDate dia = mes.atDay(entre(1, 6)); !dia.isAfter(mes.atEndOfMonth()); dia = dia.plusDays(entre(6, 10))) {
                    Gasto limpieza = gastoCaja(dia, CategoriaGasto.LIMPIEZA,
                            elegir("Artículos de limpieza: lavandina, desengrasante y trapos", "Bolsas de residuos y papel de cocina",
                                    "Alcohol en gel y jabón líquido para los vestuarios", "Limpiador de vidrios y franelas"),
                            redondear(entre(6_500, 18_000), 50), probabilidad(0.85) ? MetodoPago.EFECTIVO : MetodoPago.MERCADO_PAGO);
                    if (limpieza != null && mes.equals(primero.plusMonths(2)) && gastos.stream().noneMatch(Gasto::isAnulado)) {
                        anularDuplicado(limpieza);
                    }
                }
                for (int i = entre(2, 4); i > 0; i--) {
                    int cual = azar.nextInt(5);
                    String[] insumos = {"Bidones de agua para el dispenser", "Papel higiénico y toallas de papel",
                            "Librería: resma, talonarios y biromes", "Pilas para los controles del aire", "Repuestos del botiquín"};
                    int[][] montos = {{4_000, 9_000}, {6_000, 14_000}, {3_000, 8_000}, {2_500, 5_000}, {5_000, 12_000}};
                    gastoCaja(mes.atDay(entre(1, mes.lengthOfMonth())), CategoriaGasto.INSUMOS, insumos[cual],
                            redondear(entre(montos[cual][0], montos[cual][1]), 50), MetodoPago.EFECTIVO);
                }
                for (int i = entre(1, 2); i > 0; i--) {
                    int cual = azar.nextInt(6);
                    String[] arreglos = {"Cambio del cable de la polea alta", "Service de las cintas de correr",
                            "Arreglo de la mochila del baño de hombres", "Lubricación y ajuste de las máquinas",
                            "Plomero: pérdida en el vestuario de mujeres", "Cambio de tubos LED del salón"};
                    int[][] montos = {{24_000, 32_000}, {55_000, 75_000}, {15_000, 22_000}, {12_000, 18_000}, {28_000, 40_000}, {18_000, 26_000}};
                    int monto = redondear(entre(montos[cual][0], montos[cual][1]), 500);
                    if (monto > 30_000) {
                        gastoAdmin(mes, entre(1, mes.lengthOfMonth()), CategoriaGasto.MANTENIMIENTO, arreglos[cual], monto, MetodoPago.TRANSFERENCIA);
                    } else {
                        gastoCaja(mes.atDay(entre(1, mes.lengthOfMonth())), CategoriaGasto.MANTENIMIENTO, arreglos[cual], monto, MetodoPago.EFECTIVO);
                    }
                }
                if (mes.equals(YearMonth.from(apertura).plusMonths(4))) {
                    gastoAdmin(mes, entre(4, 12), CategoriaGasto.EQUIPAMIENTO, "Dos bancos regulables y una polea doble",
                            215_000, MetodoPago.TRANSFERENCIA);
                }
                if (mes.equals(YearMonth.from(apertura).plusMonths(5))) {
                    gastoAdmin(mes, entre(4, 12), CategoriaGasto.EQUIPAMIENTO, "Discos bumper y barra hexagonal",
                            142_000, MetodoPago.TARJETA_CREDITO);
                }
            }
        }

        // Sueldo de un mes trabajado, que se paga los primeros días del mes siguiente (proporcional el primer mes)
        private void sueldo(Empleado e, YearMonth trabajado, YearMonth pago) {
            LocalDate desde = trabajado.atDay(1);
            if (e.ingreso().isAfter(trabajado.atEndOfMonth())) {
                return;
            }
            double proporcion = e.ingreso().isAfter(desde)
                    ? (double) (ChronoUnit.DAYS.between(e.ingreso(), trabajado.atEndOfMonth()) + 1) / trabajado.lengthOfMonth() : 1;
            // Aumento de sueldos con el de los planes
            double base = trabajado.atDay(1).isBefore(aumento) ? e.sueldo() : e.sueldo() * 1.08;
            gastoAdmin(pago, entre(1, 5), CategoriaGasto.SUELDOS, "Sueldo " + nombreMes(trabajado) + " - " + e.usuario().getNombreCompleto(),
                    redondear((int) (base * proporcion), 1000), MetodoPago.TRANSFERENCIA);
        }

        private double ingresosDelMes(YearMonth mes) {
            return pagos.stream()
                    .filter(p -> p.getEstadoPago() == EstadoPago.APROBADO && YearMonth.from(p.getFechaPago()).equals(mes))
                    .mapToDouble(p -> p.getMontoAbonado().doubleValue())
                    .sum();
        }

        // Lo que paga la encargada desde la administración (no sale de la caja de recepción)
        private void gastoAdmin(YearMonth mes, int dia, CategoriaGasto categoria, String descripcion, int monto, MetodoPago metodo) {
            LocalDate fecha = proximoDiaHabil(mes.atDay(Math.min(dia, mes.lengthOfMonth())));
            LocalDateTime momento = fecha.atTime(entre(10, 16), entre(0, 59), entre(0, 59));
            if (momento.isAfter(ahora)) {
                return;
            }
            gasto(momento, categoria, descripcion, monto, metodo,
                    metodo == MetodoPago.TRANSFERENCIA && probabilidad(0.5) ? "Op. " + entre(10_000_000, 99_999_999) : null,
                    encargada.usuario());
        }

        // Lo que se compra con la plata de la caja: lo registra quien está en recepción
        private Gasto gastoCaja(LocalDate dia, CategoriaGasto categoria, String descripcion, int monto, MetodoPago metodo) {
            LocalDate fecha = proximoDiaAbierto(dia);
            LocalDateTime momento = fecha.atTime(aHora(abre(fecha) + 0.5 + azar.nextDouble() * (cierra(fecha) - abre(fecha) - 1), fecha))
                    .plusSeconds(entre(0, 59));
            if (momento.isAfter(ahora) || momento.isBefore(apertura.atStartOfDay())) {
                return null;
            }
            return gasto(momento, categoria, descripcion, monto, metodo, probabilidad(0.3) ? "Ticket " + entre(1000, 9999) : null,
                    recepcionEn(momento));
        }

        private Gasto gasto(LocalDateTime momento, CategoriaGasto categoria, String descripcion, int monto, MetodoPago metodo,
                            String comprobante, Usuario registradoPor) {
            Gasto gasto = Gasto.builder()
                    .fecha(momento)
                    .monto(BigDecimal.valueOf(monto).setScale(2, RoundingMode.HALF_UP))
                    .categoria(categoria)
                    .descripcion(descripcion)
                    .metodoPago(metodo)
                    .fueraDeCaja(false)
                    .comprobanteNro(comprobante)
                    .registradoPor(registradoPor)
                    .anulado(false)
                    .build();
            gastos.add(gasto);
            return gasto;
        }

        // Un gasto cargado dos veces por error: el repetido quedó anulado
        private void anularDuplicado(Gasto original) {
            Gasto repetido = gasto(original.getFecha().plusSeconds(entre(20, 90)), original.getCategoria(), original.getDescripcion(),
                    original.getMonto().intValue(), original.getMetodoPago(), original.getComprobanteNro(), original.getRegistradoPor());
            repetido.setAnulado(true);
            repetido.setAnuladoPor(original.getRegistradoPor());
            repetido.setFechaAnulacion(repetido.getFecha().plusMinutes(entre(4, 15)));
            repetido.setMotivoAnulacion("Cargado dos veces por error");
        }

        // ---------- Caja ----------

        /**
         * Cierres de caja como los haría recepción: al terminar el turno de la mañana y el de la noche (el sábado, uno
         * solo). Mismo cálculo que CajaService: el fondo que dejó el cierre anterior + cobros en efectivo - gastos en
         * efectivo. Un gasto en efectivo que no alcanza con la caja lo pagó el dueño (queda fuera de caja).
         */
        private void cerrarCajas() {
            List<PagoHistorial> aprobados = pagos.stream()
                    .filter(p -> p.getEstadoPago() == EstadoPago.APROBADO)
                    .sorted(Comparator.comparing(PagoHistorial::getFechaPago))
                    .toList();
            List<Gasto> egresos = gastos.stream()
                    .filter(g -> !g.isAnulado())
                    .sorted(Comparator.comparing(Gasto::getFecha))
                    .toList();
            LocalDateTime desde = apertura.atStartOfDay();
            BigDecimal fondo = BigDecimal.ZERO.setScale(2);
            for (LocalDate d = apertura; !d.isAfter(hoy); d = d.plusDays(1)) {
                if (cerrado(d)) {
                    continue;
                }
                // Al cambio de turno (los días largos) y después de cerrar el gimnasio
                LocalTime cierre = horarioDe(d).getCierra().plusMinutes(2);
                List<LocalTime> horas = diaCorto(d) ? List.of(cierre) : List.of(cambioDeTurno(d).minusMinutes(2), cierre);
                for (LocalTime hora : horas) {
                    LocalDateTime hasta = d.atTime(hora).plusSeconds(entre(0, 420));
                    if (hasta.isAfter(ahora)) {
                        return; // el turno que sigue abierto
                    }
                    fondo = cerrar(desde, hasta, fondo, aprobados, egresos, hora.equals(cierre));
                    desde = hasta;
                }
            }
        }

        private BigDecimal cerrar(LocalDateTime desde, LocalDateTime hasta, BigDecimal fondo, List<PagoHistorial> aprobados,
                                  List<Gasto> egresos, boolean finDelDia) {
            Map<MetodoPago, BigDecimal> ingresos = new EnumMap<>(MetodoPago.class);
            Map<MetodoPago, BigDecimal> salidas = new EnumMap<>(MetodoPago.class);
            int cobros = 0;
            int cantidadGastos = 0;
            BigDecimal efectivo = fondo;
            // En orden: cada gasto en efectivo se paga con lo que había en la caja en ese momento
            int i = 0;
            List<PagoHistorial> delTurno = aprobados.stream()
                    .filter(p -> !p.getFechaPago().isBefore(desde) && p.getFechaPago().isBefore(hasta)).toList();
            for (Gasto g : egresos.stream().filter(g -> !g.getFecha().isBefore(desde) && g.getFecha().isBefore(hasta)).toList()) {
                while (i < delTurno.size() && delTurno.get(i).getFechaPago().isBefore(g.getFecha())) {
                    efectivo = sumarCobro(delTurno.get(i++), efectivo, ingresos);
                    cobros++;
                }
                if (g.isFueraDeCaja()) {
                    continue;
                }
                if (g.getMetodoPago() == MetodoPago.EFECTIVO) {
                    if (g.getMonto().compareTo(efectivo) > 0) {
                        g.setFueraDeCaja(true);
                        continue;
                    }
                    efectivo = efectivo.subtract(g.getMonto());
                }
                salidas.merge(g.getMetodoPago(), g.getMonto(), BigDecimal::add);
                cantidadGastos++;
            }
            while (i < delTurno.size()) {
                efectivo = sumarCobro(delTurno.get(i++), efectivo, ingresos);
                cobros++;
            }

            BigDecimal ingresosEfectivo = ingresos.getOrDefault(MetodoPago.EFECTIVO, BigDecimal.ZERO.setScale(2));
            BigDecimal egresosEfectivo = salidas.getOrDefault(MetodoPago.EFECTIVO, BigDecimal.ZERO.setScale(2));
            BigDecimal esperado = fondo.add(ingresosEfectivo).subtract(egresosEfectivo);
            BigDecimal diferencia = BigDecimal.ZERO.setScale(2);
            String observacion = null;
            if (probabilidad(0.06) && esperado.signum() > 0) {
                boolean faltante = probabilidad(0.7);
                int monto = faltante ? redondear(entre(100, 1500), 50) : redondear(entre(50, 500), 50);
                diferencia = BigDecimal.valueOf(faltante ? -Math.min(monto, esperado.intValue()) : monto).setScale(2);
                observacion = faltante
                        ? elegir("Faltante: probablemente un vuelto mal dado en la hora pico", "Faltante sin identificar: se revisan los cobros del turno",
                        "Faltante: se pagó un delivery de agua y no se cargó el gasto")
                        : elegir("Sobrante: un socio dejó el vuelto", "Sobrante: se cobró de más y el socio no volvió a buscarlo");
            } else if (probabilidad(0.03)) {
                observacion = elegir("Sin novedades", "Todo en orden", "Se cambió el rollo del posnet");
            }
            BigDecimal contado = esperado.add(diferencia);
            BigDecimal retiro = BigDecimal.ZERO.setScale(2);
            if (finDelDia && contado.compareTo(FONDO_DE_CAJA) > 0 && probabilidad(0.85)) {
                retiro = contado.subtract(FONDO_DE_CAJA); // el dueño se lleva todo menos el fondo para el cambio
            }
            List<TotalMetodoCierre> metodos = new ArrayList<>();
            for (MetodoPago metodo : MetodoPago.values()) {
                if (ingresos.containsKey(metodo) || salidas.containsKey(metodo)) {
                    metodos.add(new TotalMetodoCierre(metodo, ingresos.getOrDefault(metodo, BigDecimal.ZERO.setScale(2)),
                            salidas.getOrDefault(metodo, BigDecimal.ZERO.setScale(2))));
                }
            }
            cierres.add(CierreCaja.builder()
                    .desde(desde)
                    .hasta(hasta)
                    .fondoInicial(fondo)
                    .ingresosEfectivo(ingresosEfectivo)
                    .egresosEfectivo(egresosEfectivo)
                    .efectivoEsperado(esperado)
                    .efectivoContado(contado)
                    .diferencia(diferencia)
                    .retiro(retiro)
                    .fondoSiguiente(contado.subtract(retiro))
                    .totalIngresos(ingresos.values().stream().reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add))
                    .totalEgresos(salidas.values().stream().reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add))
                    .cantidadCobros(cobros)
                    .cantidadGastos(cantidadGastos)
                    .observacion(observacion)
                    .cerradoPor(recepcionEn(hasta.minusMinutes(1)))
                    .metodos(metodos)
                    .build());
            return contado.subtract(retiro);
        }

        private BigDecimal sumarCobro(PagoHistorial p, BigDecimal efectivo, Map<MetodoPago, BigDecimal> ingresos) {
            ingresos.merge(p.getMetodoPago(), p.getMontoAbonado(), BigDecimal::add);
            return p.getMetodoPago() == MetodoPago.EFECTIVO ? efectivo.add(p.getMontoAbonado()) : efectivo;
        }

        // ---------- Guardado ----------

        private void guardar() {
            logs.sort(Comparator.comparing(LogAsistencia::getFechaHora));
            logAsistenciaRepository.saveAll(logs);
            turnos.sort(Comparator.comparing(TurnoPersonal::getEntrada));
            turnoPersonalRepository.saveAll(turnos);
            suscripcionRepository.saveAll(suscripciones);
            congelamientoRepository.saveAll(congelamientos);
            pagos.sort(Comparator.comparing(PagoHistorial::getFechaPago));
            pagoHistorialRepository.saveAll(pagos);
            for (Socio s : socios) {
                if (s.debitoActivo()) {
                    s.debito.setProximoCobro(s.vence());
                    s.debito.setMonto(precio(s.debito.getPlan(), hoy));
                    s.debito.setUltimaSincronizacion(ahora.minusMinutes(entre(3, 55)));
                }
            }
            debitoAutomaticoRepository.saveAll(debitos);
            guardarCertificados();
            gastos.sort(Comparator.comparing(Gasto::getFecha));
            gastoRepository.saveAll(gastos);
            cierreCajaRepository.saveAll(cierres);
            // Las clases que quedaron sin profesor (se borró el de prueba) pasan a la profesora de la tarde
            for (Clase clase : claseRepository.findAll()) {
                if (clase.getProfesor() == null) {
                    clase.setProfesor(empleado("PROFESOR_PARCIAL").usuario());
                }
            }
        }

        // Cada certificado es un PDF con los datos del socio, en la misma carpeta que usa ArchivoService
        private void guardarCertificados() {
            Path carpeta = Paths.get(directorioArchivos).toAbsolutePath().normalize().resolve("certificados");
            List<CertificadoMedico> certificados = new ArrayList<>();
            try {
                Files.createDirectories(carpeta);
                for (Socio s : socios) {
                    for (Apto apto : s.aptos) {
                        CertificadoMedico c = apto.certificado;
                        if (c.getEstadoLegal() == EstadoLegalCertificado.VIGENTE && c.getFechaVencimiento().isBefore(hoy)) {
                            c.setEstadoLegal(EstadoLegalCertificado.VENCIDO); // lo que hace la revisión de medianoche
                        }
                        String nombre = "socio-" + s.usuario.getIdUsuario() + "-" + UUID.randomUUID() + ".pdf";
                        Files.write(carpeta.resolve(nombre), pdfCertificado(s, apto));
                        c.setArchivoUrl("certificados/" + nombre);
                        certificados.add(c);
                    }
                }
            } catch (IOException e) {
                throw new UncheckedIOException("No se pudieron guardar los certificados de la demo", e);
            }
            certificados.sort(Comparator.comparing(CertificadoMedico::getFechaEmision));
            certificadoMedicoRepository.saveAll(certificados);
        }

        private byte[] pdfCertificado(Socio s, Apto apto) {
            CertificadoMedico c = apto.certificado;
            List<String> lineas = new ArrayList<>();
            lineas.add("18|CERTIFICADO MÉDICO DE APTITUD FÍSICA");
            lineas.add("11|" + apto.medico);
            lineas.add("11|Consultorio: " + CALLES[Math.abs(s.usuario.getNombreCompleto().hashCode()) % CALLES.length] + " "
                    + (100 + Math.abs(s.usuario.getDni().hashCode()) % 900) + " - Neuquén");
            lineas.add("11|");
            lineas.add("12|Certifico que " + s.usuario.getNombreCompleto() + ", DNI " + s.usuario.getDni() + ",");
            lineas.add("12|de " + s.edad + " años, fue evaluado/a clínicamente y se encuentra APTO/A");
            lineas.add("12|para realizar actividad física en gimnasio.");
            lineas.add("11|");
            if (c.getObservacionesPatologias() == null) {
                lineas.add("12|Observaciones: sin patologías que contraindiquen la actividad física.");
            } else {
                lineas.add("12|Observaciones:");
                for (String patologia : c.getObservacionesPatologias().split(", ")) {
                    lineas.add("12|  - " + patologia);
                }
            }
            lineas.add("11|");
            lineas.add("11|Neuquén, " + c.getFechaEmision().getDayOfMonth() + " de "
                    + c.getFechaEmision().getMonth().getDisplayName(TextStyle.FULL, Locale.of("es")) + " de " + c.getFechaEmision().getYear());
            lineas.add("11|Validez: 12 meses desde la fecha de emisión.");
            lineas.add("11|");
            lineas.add("10|" + (apto.rechazadoDesde != null ? "(sin sello)" : "Firma y sello: " + apto.medico.substring(0, apto.medico.indexOf(" - "))));
            return pdf(lineas);
        }

        // ---------- Registro y azar ----------

        private LogAsistencia log(Usuario usuario, LocalDateTime momento, TipoEventoAsistencia tipo, ResultadoAsistencia resultado) {
            LogAsistencia log = LogAsistencia.builder()
                    .usuario(usuario)
                    .fechaHora(momento)
                    .tipoEvento(tipo)
                    .resultado(resultado)
                    .build();
            logs.add(log);
            return log;
        }

        private String nombreUnico(String genero, String apellido) {
            for (int intento = 0; ; intento++) {
                boolean mujer = "Femenino".equals(genero) || (!"Masculino".equals(genero) && azar.nextBoolean());
                String[] lista = mujer ? NOMBRES_MUJER : NOMBRES_HOMBRE;
                String nombre = lista[azar.nextInt(lista.length)];
                if (probabilidad(0.12)) {
                    nombre += " " + lista[azar.nextInt(lista.length)]; // segundo nombre
                }
                String completo = nombre + " " + (intento > 5 ? APELLIDOS[azar.nextInt(APELLIDOS.length)] : apellido);
                if (nombres.add(completo) && !completo.split(" ")[0].equals(completo.split(" ").length > 2 ? completo.split(" ")[1] : "")) {
                    return completo;
                }
            }
        }

        private String email(String nombreCompleto, int anioNacimiento) {
            String[] partes = sinTildes(nombreCompleto).toLowerCase(Locale.ROOT).split(" ");
            String nombre = partes[0];
            String apellido = partes[partes.length - 1];
            double r = azar.nextDouble();
            String base = r < 0.4 ? nombre + "." + apellido
                    : r < 0.65 ? nombre + apellido + entre(1, 99)
                    : r < 0.85 ? nombre.charAt(0) + apellido
                    : apellido + "." + nombre + (anioNacimiento % 100);
            // example.com está reservado: ningún mail de la demo le llega a una persona real
            String email = base + "@example.com";
            while (!emails.add(email)) {
                email = base + entre(1, 999) + "@example.com";
            }
            return email;
        }

        // DNI acorde a la edad (en Argentina se asignan por año de nacimiento)
        private String dni(int anioNacimiento) {
            while (true) {
                long numero = 21_000_000L + (anioNacimiento - 1970) * 700_000L + entre(-600_000, 600_000);
                String dni = String.valueOf(Math.max(10_000_000L, numero));
                if (dnis.add(dni)) {
                    return dni;
                }
            }
        }

        private String telefono() {
            String area = probabilidad(0.05) ? "11" : "299";
            int numero = area.equals("11") ? entre(15_000_000, 69_999_999) : entre(4_000_000, 6_999_999);
            String texto = String.valueOf(numero);
            return area + " " + texto.substring(0, texto.length() - 4) + "-" + texto.substring(texto.length() - 4);
        }

        private String domicilio() {
            String calle = CALLES[azar.nextInt(CALLES.length)] + " " + entre(50, 4200);
            return probabilidad(0.25) ? calle + ", depto " + entre(1, 9) + elegir("A", "B", "C", "D") : calle;
        }

        private String ciudad() {
            String[] ciudades = {"Neuquén", "Plottier", "Centenario", "Cipolletti", "Cinco Saltos"};
            return ciudades[ponderado(new double[]{74, 9, 7, 8, 2})];
        }

        private int entre(int desde, int hasta) {
            return desde + azar.nextInt(hasta - desde + 1);
        }

        private boolean probabilidad(double p) {
            return azar.nextDouble() < p;
        }

        @SafeVarargs
        private <T> T elegir(T... opciones) {
            return opciones[azar.nextInt(opciones.length)];
        }

        private int ponderado(double[] pesos) {
            double total = 0;
            for (double peso : pesos) {
                total += peso;
            }
            double r = azar.nextDouble() * total;
            for (int i = 0; i < pesos.length; i++) {
                r -= pesos[i];
                if (r < 0) {
                    return i;
                }
            }
            return pesos.length - 1;
        }

        // ---------- Calendario ----------

        // El horario de ese día según Datos del gimnasio. Los feriados abre con el horario del sábado (si el sábado no
        // abre, cierra)
        private HorarioGimnasio horarioDe(LocalDate d) {
            if (FERIADOS.contains(MonthDay.from(d)) && d.getDayOfWeek() != DayOfWeek.SUNDAY) {
                return horario.get(DayOfWeek.SATURDAY);
            }
            return horario.get(d.getDayOfWeek());
        }

        private boolean cerrado(LocalDate d) {
            HorarioGimnasio h = horarioDe(d);
            return h == null || !h.abierto();
        }

        private double abre(LocalDate d) {
            return horarioDe(d).getAbre().toSecondOfDay() / 3600.0;
        }

        private double cierra(LocalDate d) {
            return horarioDe(d).getCierra().toSecondOfDay() / 3600.0;
        }

        // Un día de pocas horas (como el sábado): lo cubre una sola persona por puesto y la caja se cierra una vez
        private boolean diaCorto(LocalDate d) {
            return cierra(d) - abre(d) < 8;
        }

        // A mitad del horario (redondeado a la hora) cambian los turnos de la mañana y la tarde
        private LocalTime cambioDeTurno(LocalDate d) {
            return LocalTime.of((int) Math.round((abre(d) + cierra(d)) / 2), 0);
        }

        private boolean enRecesoInvernal(LocalDate d) {
            MonthDay dia = MonthDay.from(d);
            return !dia.isBefore(INICIO_RECESO_INVERNAL) && !dia.isAfter(FIN_RECESO_INVERNAL);
        }

        private LocalDate proximoDiaAbierto(LocalDate d) {
            while (cerrado(d)) {
                d = d.plusDays(1);
            }
            return d;
        }

        private LocalDate proximoDiaHabil(LocalDate d) {
            while (cerrado(d) || diaCorto(d)) {
                d = d.plusDays(1);
            }
            return d;
        }

        private List<LocalDate> diasAbiertos(LocalDate desde, LocalDate hasta) {
            List<LocalDate> dias = new ArrayList<>();
            for (LocalDate d = desde; !d.isAfter(hasta); d = d.plusDays(1)) {
                if (!cerrado(d)) {
                    dias.add(d);
                }
            }
            return dias;
        }

        private Set<LocalDate> diasHabilesDesde(LocalDate desde, int cantidad) {
            Set<LocalDate> dias = new HashSet<>();
            for (LocalDate d = proximoDiaHabil(desde); dias.size() < cantidad; d = proximoDiaHabil(d.plusDays(1))) {
                dias.add(d);
            }
            return dias;
        }

        // Esa fecha dentro de los 6 meses simulados (el año de la apertura o el siguiente)
        private LocalDate fechaDelAnio(int mes, int dia) {
            LocalDate fecha = LocalDate.of(apertura.getYear(), mes, dia);
            return fecha.isBefore(apertura) ? fecha.plusYears(1) : fecha;
        }
    }

    // ---------- Auxiliares ----------

    private static String nombreMes(YearMonth mes) {
        String nombre = mes.getMonth().getDisplayName(TextStyle.FULL, Locale.of("es"));
        return nombre + " " + mes.getYear();
    }

    private static int redondear(int monto, int multiplo) {
        return Math.round((float) monto / multiplo) * multiplo;
    }

    private static String sinTildes(String texto) {
        return Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    /** Un PDF de una página con líneas de texto ("tamaño|texto"), en Helvetica con tildes (WinAnsi). */
    private static byte[] pdf(List<String> lineas) {
        StringBuilder contenido = new StringBuilder();
        int y = 740;
        for (String linea : lineas) {
            int separador = linea.indexOf('|');
            int tamano = Integer.parseInt(linea.substring(0, separador));
            String texto = linea.substring(separador + 1).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
            contenido.append("BT /F1 ").append(tamano).append(" Tf 72 ").append(y).append(" Td (").append(texto).append(") Tj ET\n");
            y -= tamano + 9;
        }
        List<String> objetos = List.of(
                "<< /Type /Catalog /Pages 2 0 R >>",
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
                "<< /Length " + contenido.toString().getBytes(StandardCharsets.ISO_8859_1).length + " >>\nstream\n" + contenido + "endstream",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
        StringBuilder pdf = new StringBuilder("%PDF-1.4\n");
        List<Integer> posiciones = new ArrayList<>();
        for (int i = 0; i < objetos.size(); i++) {
            posiciones.add(pdf.toString().getBytes(StandardCharsets.ISO_8859_1).length);
            pdf.append(i + 1).append(" 0 obj\n").append(objetos.get(i)).append("\nendobj\n");
        }
        int xref = pdf.toString().getBytes(StandardCharsets.ISO_8859_1).length;
        pdf.append("xref\n0 ").append(objetos.size() + 1).append("\n0000000000 65535 f \n");
        for (int posicion : posiciones) {
            pdf.append(String.format("%010d 00000 n \n", posicion));
        }
        pdf.append("trailer\n<< /Size ").append(objetos.size() + 1).append(" /Root 1 0 R >>\nstartxref\n").append(xref).append("\n%%EOF\n");
        return pdf.toString().getBytes(StandardCharsets.ISO_8859_1);
    }
}
