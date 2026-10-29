package com.summit.backend.service;

import com.summit.backend.dto.AsistenciaPersonalDTO;
import com.summit.backend.dto.AsistenciaPersonalDTO.Correccion;
import com.summit.backend.dto.AsistenciaPersonalDTO.Dia;
import com.summit.backend.dto.AsistenciaPersonalDTO.Miembro;
import com.summit.backend.dto.AsistenciaPersonalDTO.Persona;
import com.summit.backend.dto.AsistenciaPersonalDTO.Totales;
import com.summit.backend.dto.AsistenciaPersonalDTO.Turno;
import com.summit.backend.dto.CheckInResponse;
import com.summit.backend.dto.TurnoRequest;
import com.summit.backend.model.AccionCorreccion;
import com.summit.backend.model.CorreccionTurno;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.LogAsistencia;
import com.summit.backend.model.OrigenTurno;
import com.summit.backend.model.ResultadoAsistencia;
import com.summit.backend.model.Rol;
import com.summit.backend.model.TipoEventoAsistencia;
import com.summit.backend.model.TurnoPersonal;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.CorreccionTurnoRepository;
import com.summit.backend.repository.LogAsistenciaRepository;
import com.summit.backend.repository.TurnoPersonalRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Asistencia del personal (FASES.md, Fase 9): entradas y salidas del equipo, horas trabajadas y correcciones.
 *
 * <p>El equipo (recepción, profesores y administradores) ficha en el mismo control de acceso que los socios, sin
 * pasos de más: si la persona tiene un turno en curso, su paso por recepción es la salida; si no, es una entrada.
 * Cada paso queda además en logs_asistencia, como el presentismo de antes: INGRESO_MOLINETE la entrada y CHECKOUT la
 * salida (el tablero y las métricas no cuentan las salidas como ingresos).</p>
 *
 * <p>Casos raros:</p>
 * <ul>
 *   <li>Entra dos veces el mismo día (turno partido): son dos turnos y el día suma los dos.</li>
 *   <li>Trabaja pasada la medianoche: el turno es uno solo y cuenta en el día en que empezó.</li>
 *   <li>Se olvidó de marcar la salida: un turno sin salida que empezó hace más de HORAS_MAXIMAS_TURNO deja de estar en
 *       curso; el próximo paso por recepción es una entrada y ese turno queda incompleto hasta que el admin carga la
 *       salida. Nunca se inventa una hora de salida.</li>
 *   <li>El sistema lo tomó al revés (por ejemplo, se olvidó de marcar la salida al mediodía y a la tarde vuelve: su
 *       paso cierra el turno de la mañana): recepción lo corrige en el momento, durante MINUTOS_PARA_INVERTIR minutos,
 *       con "Es una entrada" o "Es una salida". Queda como corrección de quien la hizo.</li>
 *   <li>El mismo DNI dos veces seguidas (el lector leyó dos veces): dentro de MINUTOS_REPETIDA no se registra nada.</li>
 * </ul>
 *
 * <p>El admin carga turnos olvidados, corrige horas y anula turnos: cada cambio guarda quién lo hizo, cuándo, por qué
 * y las horas de antes y de después (CorreccionTurno).</p>
 */
@Service
@RequiredArgsConstructor
public class AsistenciaPersonalService {

    /** Un turno sin salida que empezó hace más que esto ya no está en curso: se olvidó de marcar la salida. */
    public static final int HORAS_MAXIMAS_TURNO = 16;
    // Ningún turno puede durar más (al corregirlo, o al cerrar desde recepción uno que había quedado sin salida)
    private static final int HORAS_MAXIMAS_CORRECCION = 24;
    // El mismo DNI otra vez dentro de estos minutos (el lector leyó dos veces): no se registra nada
    private static final int MINUTOS_REPETIDA = 2;
    // Durante estos minutos recepción puede corregir "era una entrada" o "era una salida"; después, el admin
    private static final int MINUTOS_PARA_INVERTIR = 15;
    // Al registrar la salida de un turno más largo, se avisa por si en realidad estaba llegando
    private static final int HORAS_TURNO_LARGO = 12;
    // Los turnos sin salida de estos últimos días se avisan arriba de la pantalla, sea cual sea el período
    private static final int DIAS_SIN_SALIDA = 31;
    private static final int MAX_DIAS_PERIODO = 366;
    private static final int LARGO_MAXIMO_MOTIVO = 200;

    static final String ENTRADA = "ENTRADA";
    static final String SALIDA = "SALIDA";
    // Estados de un turno en el reporte
    static final String COMPLETO = "COMPLETO";
    static final String EN_CURSO = "EN_CURSO";
    static final String SIN_SALIDA = "SIN_SALIDA";

    private static final List<Rol> ROLES_PERSONAL = List.of(Rol.ADMIN, Rol.RECEPCION, Rol.PROFESOR);
    private static final DateTimeFormatter FECHA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");
    private static final String[] DIAS = {"lun", "mar", "mié", "jue", "vie", "sáb", "dom"};

    private final TurnoPersonalRepository turnoRepository;
    private final CorreccionTurnoRepository correccionRepository;
    private final LogAsistenciaRepository logAsistenciaRepository;
    private final UsuarioRepository usuarioRepository;
    private final TransactionTemplate transacciones;

    // Los cambios en los turnos van de a uno, cada uno en su transacción: dos pasos del mismo DNI casi a la vez, o
    // recepción y el admin al mismo tiempo, no pueden abrir dos turnos ni cerrar el mismo dos veces. Son pocos por
    // día, así que alcanza con un solo candado
    private final Object candado = new Object();

    // ---------- Recepción ----------

    /**
     * Paso de una persona del equipo por el control de acceso: si tiene un turno en curso es la salida; si no, una
     * entrada. Con la cuenta inactiva no puede entrar, pero sí cerrar el turno que tenía en curso.
     */
    public CheckInResponse ficharEnRecepcion(Usuario persona) {
        synchronized (candado) {
            return transacciones.execute(estado -> fichar(persona.getIdUsuario()));
        }
    }

    private CheckInResponse fichar(Long idUsuario) {
        Usuario persona = usuarioRepository.findById(idUsuario)
                .orElseThrow(() -> new NoSuchElementException("Usuario no encontrado"));
        LocalDateTime ahora = LocalDateTime.now();
        TurnoPersonal ultimo = ultimoTurno(idUsuario);

        // El mismo DNI otra vez enseguida (el lector leyó dos veces, o se volvió a escribir): se muestra lo mismo
        LocalDateTime pasoAnterior = ultimo != null ? pasoEnRecepcion(ultimo) : null;
        if (pasoAnterior != null && pasoAnterior.isAfter(ahora.minusMinutes(MINUTOS_REPETIDA))) {
            boolean fueSalida = ultimo.getSalida() != null;
            CheckInResponse ficha = fueSalida
                    ? fichaSalida(persona, ultimo, ahora)
                    : fichaEntrada(persona, ultimo, anteriorSinSalida(ultimo), ahora);
            ficha.setFichadaRepetida(true);
            ficha.getAvisos().add(0, "Ya se había registrado su " + (fueSalida ? "salida" : "entrada") + " a las "
                    + pasoAnterior.format(HORA) + ": no se registró otra vez");
            return ficha;
        }

        if (ultimo != null && enCurso(ultimo, ahora)) {
            ultimo.setSalida(ahora);
            ultimo.setLogSalida(registrarLog(persona, TipoEventoAsistencia.CHECKOUT, ResultadoAsistencia.PERMITIDO, ahora));
            return fichaSalida(persona, ultimo, ahora);
        }

        if (persona.getEstado() != EstadoUsuario.ACTIVO) {
            registrarLog(persona, TipoEventoAsistencia.INGRESO_MOLINETE, ResultadoAsistencia.DENEGADO_CUENTA_INACTIVA, ahora);
            return fichaCuentaInactiva(persona, ahora);
        }

        // Si el último turno no tiene salida (y ya no está en curso), se olvidó de marcarla: queda incompleto
        TurnoPersonal sinSalida = ultimo != null && ultimo.getSalida() == null ? ultimo : null;
        TurnoPersonal turno = turnoRepository.save(TurnoPersonal.builder()
                .usuario(persona)
                .entrada(ahora)
                .origen(OrigenTurno.RECEPCION)
                .logEntrada(registrarLog(persona, TipoEventoAsistencia.INGRESO_MOLINETE, ResultadoAsistencia.PERMITIDO, ahora))
                .build());
        return fichaEntrada(persona, turno, sinSalida, ahora);
    }

    /**
     * Recepción corrige en el momento un paso que el sistema tomó al revés. fichadaMostrada es lo que dice la ficha:
     * SALIDA = en realidad está llegando (el turno que se cerró vuelve a quedar sin salida y empieza uno nuevo);
     * ENTRADA = en realidad se está yendo (su paso cierra el turno anterior, que había quedado sin salida).
     * Solo el último paso de la persona y durante MINUTOS_PARA_INVERTIR minutos; después lo corrige el admin.
     */
    public CheckInResponse invertirFichada(Long idTurno, String fichadaMostrada, String emailOperador) {
        synchronized (candado) {
            return transacciones.execute(estado -> invertir(idTurno, fichadaMostrada, emailOperador));
        }
    }

    private CheckInResponse invertir(Long idTurno, String fichadaMostrada, String emailOperador) {
        boolean muestraSalida = SALIDA.equals(fichadaMostrada);
        if (idTurno == null || (!muestraSalida && !ENTRADA.equals(fichadaMostrada))) {
            throw new IllegalArgumentException("Faltan el turno y lo que dice la ficha (ENTRADA o SALIDA)");
        }
        TurnoPersonal turno = turnoRepository.findById(idTurno)
                .filter(t -> !t.isAnulado())
                .orElseThrow(() -> new NoSuchElementException("No se encontró ese turno"));
        if (muestraSalida != (turno.getSalida() != null)) {
            throw new IllegalStateException("Ese paso por recepción ya se corrigió");
        }
        TurnoPersonal ultimo = ultimoTurno(turno.getUsuario().getIdUsuario());
        if (ultimo == null || !ultimo.getIdTurno().equals(idTurno)) {
            throw new IllegalStateException("Después hubo otro paso por recepción: la corrección la hace el administrador "
                    + "en Asistencia del personal");
        }
        LocalDateTime ahora = LocalDateTime.now();
        LocalDateTime paso = pasoEnRecepcion(turno);
        if (paso == null) {
            throw new IllegalStateException("Esa hora la cargó el administrador: la corrección la hace él en Asistencia del personal");
        }
        if (paso.isBefore(ahora.minusMinutes(MINUTOS_PARA_INVERTIR))) {
            throw new IllegalStateException("Pasaron más de " + MINUTOS_PARA_INVERTIR + " minutos: la corrección la hace "
                    + "el administrador en Asistencia del personal");
        }
        Usuario operador = usuario(emailOperador);
        return muestraSalida ? eraUnaEntrada(turno, operador, ahora) : eraUnaSalida(turno, operador, ahora);
    }

    // La ficha dice SALIDA pero está llegando: el turno vuelve a quedar sin salida (la carga el admin) y su paso abre
    // uno nuevo
    private CheckInResponse eraUnaEntrada(TurnoPersonal turno, Usuario operador, LocalDateTime ahora) {
        Usuario persona = turno.getUsuario();
        if (persona.getEstado() != EstadoUsuario.ACTIVO) {
            throw new IllegalStateException("Cuenta " + AsistenciaService.textoEstado(persona.getEstado())
                    + ": no puede registrar su entrada");
        }
        LogAsistencia paso = turno.getLogSalida();
        registrarCorreccion(turno, AccionCorreccion.CAMBIO, turno.getEntrada(), null,
                "En recepción: era una entrada, no la salida de este turno", operador);
        turno.setSalida(null);
        turno.setLogSalida(null);
        paso.setTipoEvento(TipoEventoAsistencia.INGRESO_MOLINETE);
        TurnoPersonal nuevo = turnoRepository.save(TurnoPersonal.builder()
                .usuario(persona)
                .entrada(paso.getFechaHora())
                .origen(OrigenTurno.RECEPCION)
                .logEntrada(paso)
                .build());
        return fichaEntrada(persona, nuevo, turno, ahora);
    }

    // La ficha dice ENTRADA pero se está yendo: el turno que abrió su paso se borra y el paso cierra el anterior, que
    // había quedado sin salida
    private CheckInResponse eraUnaSalida(TurnoPersonal turno, Usuario operador, LocalDateTime ahora) {
        if (correccionRepository.existsByTurnoIdTurno(turno.getIdTurno())) {
            throw new IllegalStateException("Ese turno ya lo corrigió el administrador");
        }
        TurnoPersonal anterior = anteriorSinSalida(turno);
        if (anterior == null) {
            throw new IllegalStateException("No hay un turno anterior sin salida para cerrar: fue una entrada");
        }
        LogAsistencia paso = turno.getLogEntrada();
        if (!cierraEnPlazo(anterior, paso.getFechaHora())) {
            throw new IllegalStateException("El turno sin salida empezó hace más de " + HORAS_MAXIMAS_CORRECCION
                    + " horas: la salida la carga el administrador en Asistencia del personal");
        }
        registrarCorreccion(anterior, AccionCorreccion.CAMBIO, anterior.getEntrada(), paso.getFechaHora(),
                "En recepción: era la salida de este turno, no una entrada", operador);
        anterior.setSalida(paso.getFechaHora());
        anterior.setLogSalida(paso);
        paso.setTipoEvento(TipoEventoAsistencia.CHECKOUT);
        turnoRepository.delete(turno);
        return fichaSalida(anterior.getUsuario(), anterior, ahora);
    }

    // ---------- Admin: reporte ----------

    /**
     * Horas del equipo en un período (fechas incluidas), opcionalmente de una sola persona. Los turnos cuentan en el día
     * en que empezaron; solo suman los completos (los en curso y los sin salida se marcan aparte).
     */
    @Transactional(readOnly = true)
    public AsistenciaPersonalDTO reporte(LocalDate desde, LocalDate hasta, Long idUsuario) {
        if (desde == null || hasta == null) {
            throw new IllegalArgumentException("Elegí el período");
        }
        if (desde.isAfter(hasta)) {
            throw new IllegalArgumentException("La fecha de inicio no puede ser posterior a la de fin");
        }
        if (ChronoUnit.DAYS.between(desde, hasta) >= MAX_DIAS_PERIODO) {
            throw new IllegalArgumentException("El período no puede superar un año");
        }
        LocalDateTime ahora = LocalDateTime.now();
        Map<Long, TurnoPersonal> enCurso = enCursoPorPersona(ahora);
        Set<Long> idsEnCurso = ids(enCurso.values());

        List<TurnoPersonal> turnos = turnoRepository.findByEntradaGreaterThanEqualAndEntradaLessThanOrderByEntradaAscIdTurnoAsc(
                desde.atStartOfDay(), hasta.plusDays(1).atStartOfDay());
        if (idUsuario != null) {
            turnos = turnos.stream().filter(t -> t.getUsuario().getIdUsuario().equals(idUsuario)).toList();
        }
        List<TurnoPersonal> trabajando = enCurso.values().stream()
                .sorted(Comparator.comparing(TurnoPersonal::getEntrada))
                .toList();
        List<TurnoPersonal> sinSalida = turnoRepository
                .findBySalidaIsNullAndAnuladoFalseAndEntradaGreaterThanEqualOrderByEntradaAscIdTurnoAsc(
                        ahora.toLocalDate().minusDays(DIAS_SIN_SALIDA).atStartOfDay())
                .stream()
                .filter(t -> !idsEnCurso.contains(t.getIdTurno()))
                .toList();

        Set<Long> conCorrecciones = new HashSet<>(ids(turnos));
        conCorrecciones.addAll(ids(trabajando));
        conCorrecciones.addAll(ids(sinSalida));
        Map<Long, List<Correccion>> correcciones = correcciones(conCorrecciones);

        // Personas: el personal activo (aunque no haya trabajado), más quien tenga turnos en el período
        List<Usuario> equipo = personal();
        Map<Long, List<TurnoPersonal>> porPersona = turnos.stream()
                .collect(Collectors.groupingBy(t -> t.getUsuario().getIdUsuario(), LinkedHashMap::new, Collectors.toList()));
        Map<Long, Usuario> delPeriodo = new LinkedHashMap<>();
        for (Usuario u : equipo) {
            boolean corresponde = idUsuario == null ? u.getEstado() == EstadoUsuario.ACTIVO : u.getIdUsuario().equals(idUsuario);
            if (corresponde || porPersona.containsKey(u.getIdUsuario())) {
                delPeriodo.put(u.getIdUsuario(), u);
            }
        }
        turnos.forEach(t -> delPeriodo.putIfAbsent(t.getUsuario().getIdUsuario(), t.getUsuario())); // si dejó de ser personal

        List<Persona> personas = delPeriodo.values().stream()
                .sorted(Comparator.comparing(Usuario::getNombreCompleto, String.CASE_INSENSITIVE_ORDER))
                .map(u -> persona(u, porPersona.getOrDefault(u.getIdUsuario(), List.of()), idsEnCurso,
                        enCurso.containsKey(u.getIdUsuario()), correcciones, ahora))
                .toList();

        Totales totales = new Totales(
                personas.stream().mapToLong(Persona::minutos).sum(),
                personas.stream().mapToInt(Persona::diasTrabajados).sum(),
                (int) personas.stream().filter(p -> p.diasTrabajados() > 0).count(),
                (int) turnos.stream().filter(t -> !t.isAnulado() && SIN_SALIDA.equals(estado(t, idsEnCurso))).count());
        return new AsistenciaPersonalDTO(desde, hasta,
                equipo.stream().map(u -> new Miembro(u.getIdUsuario(), u.getNombreCompleto(), u.getRol().name(),
                        u.getEstado() == EstadoUsuario.ACTIVO)).toList(),
                personas,
                totales,
                trabajando.stream().map(t -> turnoDTO(t, idsEnCurso, correcciones, ahora)).toList(),
                sinSalida.stream().map(t -> turnoDTO(t, idsEnCurso, correcciones, ahora)).toList());
    }

    // Resumen de una persona en el período y su detalle por día
    private Persona persona(Usuario u, List<TurnoPersonal> turnos, Set<Long> idsEnCurso, boolean trabajandoAhora,
                            Map<Long, List<Correccion>> correcciones, LocalDateTime ahora) {
        Map<LocalDate, List<TurnoPersonal>> porDia = turnos.stream()
                .collect(Collectors.groupingBy(t -> t.getEntrada().toLocalDate(), TreeMap::new, Collectors.toList()));
        List<Dia> dias = new ArrayList<>();
        long minutos = 0;
        int trabajados = 0;
        int incompletos = 0;
        for (Map.Entry<LocalDate, List<TurnoPersonal>> dia : porDia.entrySet()) {
            List<Turno> delDia = dia.getValue().stream().map(t -> turnoDTO(t, idsEnCurso, correcciones, ahora)).toList();
            List<Turno> validos = delDia.stream().filter(t -> !t.anulado()).toList();
            long minutosDia = validos.stream().filter(t -> COMPLETO.equals(t.estado())).mapToLong(Turno::minutos).sum();
            boolean incompleto = validos.stream().anyMatch(t -> SIN_SALIDA.equals(t.estado()));
            dias.add(new Dia(dia.getKey(), minutosDia, incompleto,
                    validos.stream().anyMatch(t -> EN_CURSO.equals(t.estado())), delDia));
            minutos += minutosDia;
            trabajados += validos.isEmpty() ? 0 : 1;
            incompletos += incompleto ? 1 : 0;
        }
        return new Persona(u.getIdUsuario(), u.getNombreCompleto(), u.getDni(), u.getRol().name(),
                u.getEstado() == EstadoUsuario.ACTIVO, trabajandoAhora, trabajados, minutos, incompletos, dias);
    }

    // ---------- Admin: correcciones ----------

    /** Carga un turno que no pasó por recepción (la persona se olvidó de marcar la entrada). */
    public Turno agregarTurno(TurnoRequest datos, String emailAdmin) {
        synchronized (candado) {
            return transacciones.execute(estado -> {
                if (datos.idUsuario() == null) {
                    throw new IllegalArgumentException("Elegí la persona");
                }
                Usuario persona = usuarioRepository.findById(datos.idUsuario())
                        .filter(u -> u.getRol() != Rol.SOCIO)
                        .orElseThrow(() -> new NoSuchElementException("No se encontró esa persona del equipo"));
                String motivo = motivo(datos.motivo());
                validarHorario(persona, null, datos.entrada(), datos.salida());
                TurnoPersonal turno = turnoRepository.save(TurnoPersonal.builder()
                        .usuario(persona)
                        .entrada(datos.entrada())
                        .salida(datos.salida())
                        .origen(OrigenTurno.MANUAL)
                        .build());
                registrarCorreccion(turno, AccionCorreccion.ALTA, turno.getEntrada(), turno.getSalida(), motivo, usuario(emailAdmin));
                return turnoDTO(turno);
            });
        }
    }

    /** Corrige la hora de entrada o de salida de un turno, o carga la salida que faltaba. */
    public Turno corregirTurno(Long idTurno, TurnoRequest datos, String emailAdmin) {
        synchronized (candado) {
            return transacciones.execute(estado -> {
                TurnoPersonal turno = turno(idTurno);
                if (turno.isAnulado()) {
                    throw new IllegalStateException("El turno está anulado: si hace falta, cargá uno nuevo");
                }
                String motivo = motivo(datos.motivo());
                // Lo que no cambió (al minuto, que es lo que se ve) queda como estaba, con sus segundos
                LocalDateTime entrada = mismoMinuto(datos.entrada(), turno.getEntrada()) ? turno.getEntrada() : datos.entrada();
                LocalDateTime salida = mismoMinuto(datos.salida(), turno.getSalida()) ? turno.getSalida() : datos.salida();
                if (entrada == turno.getEntrada() && salida == turno.getSalida()) {
                    throw new IllegalArgumentException("No cambiaste ninguna hora");
                }
                validarHorario(turno.getUsuario(), idTurno, entrada, salida);
                registrarCorreccion(turno, AccionCorreccion.CAMBIO, entrada, salida, motivo, usuario(emailAdmin));
                turno.setEntrada(entrada);
                turno.setSalida(salida);
                return turnoDTO(turno);
            });
        }
    }

    /** Anula un turno (por ejemplo, un paso por recepción que no era un turno): deja de contar, pero queda guardado. */
    public Turno anularTurno(Long idTurno, String motivo, String emailAdmin) {
        synchronized (candado) {
            return transacciones.execute(estado -> {
                TurnoPersonal turno = turno(idTurno);
                if (turno.isAnulado()) {
                    throw new IllegalStateException("El turno ya estaba anulado");
                }
                registrarCorreccion(turno, AccionCorreccion.ANULACION, null, null, motivo(motivo), usuario(emailAdmin));
                turno.setAnulado(true);
                return turnoDTO(turno);
            });
        }
    }

    /**
     * Reglas de un turno cargado o corregido a mano: entrada y salida no más tarde que ahora, la salida después de la
     * entrada y como mucho HORAS_MAXIMAS_CORRECCION horas más tarde, sin superponerse con otro turno de la persona.
     * Sin salida solo puede quedar su último turno, si empezó hace menos de HORAS_MAXIMAS_TURNO (está trabajando).
     */
    private void validarHorario(Usuario persona, Long idTurno, LocalDateTime entrada, LocalDateTime salida) {
        LocalDateTime ahora = LocalDateTime.now();
        if (entrada == null) {
            throw new IllegalArgumentException("Falta la hora de entrada");
        }
        if (entrada.isAfter(ahora)) {
            throw new IllegalArgumentException("La entrada no puede ser más tarde que ahora");
        }
        Long excluido = idTurno != null ? idTurno : -1L;
        if (salida != null) {
            if (!salida.isAfter(entrada)) {
                throw new IllegalArgumentException("La salida tiene que ser posterior a la entrada");
            }
            if (salida.isAfter(entrada.plusHours(HORAS_MAXIMAS_CORRECCION))) {
                throw new IllegalArgumentException("Un turno no puede durar más de " + HORAS_MAXIMAS_CORRECCION
                        + " horas: revisá las fechas");
            }
            if (salida.isAfter(ahora)) {
                throw new IllegalArgumentException("La salida no puede ser más tarde que ahora");
            }
        } else if (entrada.isBefore(ahora.minusHours(HORAS_MAXIMAS_TURNO))
                || turnoRepository.existsByUsuarioIdUsuarioAndAnuladoFalseAndIdTurnoNotAndEntradaAfter(persona.getIdUsuario(), excluido, entrada)) {
            throw new IllegalArgumentException("Cargá la hora de salida: sin salida solo puede quedar el turno de alguien "
                    + "que está trabajando ahora");
        }
        // Los que pueden superponerse empezaron como mucho un día antes (ninguno dura más) y antes del final de este
        Set<Long> idsEnCurso = ids(enCursoPorPersona(ahora).values());
        for (TurnoPersonal otro : turnoRepository.findByUsuarioIdUsuarioAndAnuladoFalseAndEntradaBetween(persona.getIdUsuario(),
                entrada.minusHours(HORAS_MAXIMAS_CORRECCION), salida != null ? salida : ahora)) {
            if (!otro.getIdTurno().equals(excluido) && seSuperponen(entrada, salida, otro, idsEnCurso.contains(otro.getIdTurno()))) {
                throw new IllegalArgumentException("Se superpone con otro turno de " + persona.getNombreCompleto() + ": "
                        + descripcion(otro, idsEnCurso.contains(otro.getIdTurno())) + ". Si ese está mal, corregilo primero");
            }
        }
    }

    // [entrada, salida) contra el otro turno. Uno en curso ocupa desde su entrada en adelante; uno que quedó sin salida,
    // solo el minuto de su entrada (no se sabe hasta cuándo trabajó)
    private static boolean seSuperponen(LocalDateTime entrada, LocalDateTime salida, TurnoPersonal otro, boolean otroEnCurso) {
        LocalDateTime fin = salida != null ? salida : LocalDateTime.MAX;
        LocalDateTime finOtro = otro.getSalida() != null ? otro.getSalida()
                : otroEnCurso ? LocalDateTime.MAX : otro.getEntrada().plusMinutes(1);
        return entrada.isBefore(finOtro) && otro.getEntrada().isBefore(fin);
    }

    // "el del jue 22/10 de 07:58 a 16:03", "el que está en curso desde el jue 22/10 a las 07:58"...
    private static String descripcion(TurnoPersonal turno, boolean enCurso) {
        LocalDateTime entrada = turno.getEntrada();
        String dia = diaCorto(entrada);
        if (turno.getSalida() != null) {
            LocalDateTime salida = turno.getSalida();
            return "el del " + dia + " de " + entrada.format(HORA) + " a " + salida.format(HORA)
                    + (salida.toLocalDate().equals(entrada.toLocalDate()) ? "" : " del " + diaCorto(salida));
        }
        return enCurso
                ? "el que está en curso desde el " + dia + " a las " + entrada.format(HORA)
                : "el del " + dia + " que entró a las " + entrada.format(HORA) + " y quedó sin salida";
    }

    // ---------- Auxiliares ----------

    private TurnoPersonal ultimoTurno(Long idUsuario) {
        return turnoRepository.findFirstByUsuarioIdUsuarioAndAnuladoFalseOrderByEntradaDescIdTurnoDesc(idUsuario).orElse(null);
    }

    // El turno anterior a este, si quedó sin salida (null si no hay o si tiene salida)
    private TurnoPersonal anteriorSinSalida(TurnoPersonal turno) {
        return turnoRepository
                .findFirstByUsuarioIdUsuarioAndAnuladoFalseAndIdTurnoNotAndEntradaLessThanEqualOrderByEntradaDescIdTurnoDesc(
                        turno.getUsuario().getIdUsuario(), turno.getIdTurno(), turno.getEntrada())
                .filter(t -> t.getSalida() == null)
                .orElse(null);
    }

    private TurnoPersonal turno(Long idTurno) {
        return turnoRepository.findById(idTurno).orElseThrow(() -> new NoSuchElementException("No se encontró ese turno"));
    }

    // El último turno de la persona está en curso si no tiene salida y empezó hace menos de HORAS_MAXIMAS_TURNO
    private static boolean enCurso(TurnoPersonal ultimo, LocalDateTime ahora) {
        return ultimo.getSalida() == null && !ultimo.getEntrada().isBefore(ahora.minusHours(HORAS_MAXIMAS_TURNO));
    }

    // Turno en curso de cada persona (idUsuario -> turno): su último turno, si está en curso
    private Map<Long, TurnoPersonal> enCursoPorPersona(LocalDateTime ahora) {
        Map<Long, TurnoPersonal> ultimos = new HashMap<>();
        for (TurnoPersonal t : turnoRepository.findByAnuladoFalseAndEntradaGreaterThanEqual(ahora.minusHours(HORAS_MAXIMAS_TURNO))) {
            ultimos.merge(t.getUsuario().getIdUsuario(), t, (a, b) -> esPosterior(b, a) ? b : a);
        }
        ultimos.values().removeIf(t -> !enCurso(t, ahora));
        return ultimos;
    }

    private static boolean esPosterior(TurnoPersonal a, TurnoPersonal b) {
        int porEntrada = a.getEntrada().compareTo(b.getEntrada());
        return porEntrada != 0 ? porEntrada > 0 : a.getIdTurno() > b.getIdTurno();
    }

    // Cuándo fue el último paso por recepción del turno: el de la salida si la tiene, si no el de la entrada
    // (null si esa hora la cargó el admin)
    private static LocalDateTime pasoEnRecepcion(TurnoPersonal turno) {
        LogAsistencia paso = turno.getSalida() != null ? turno.getLogSalida() : turno.getLogEntrada();
        return paso != null ? paso.getFechaHora() : null;
    }

    // Cerrar el turno sin salida en ese momento no supera HORAS_MAXIMAS_CORRECCION
    private static boolean cierraEnPlazo(TurnoPersonal sinSalida, LocalDateTime salida) {
        return !salida.isAfter(sinSalida.getEntrada().plusHours(HORAS_MAXIMAS_CORRECCION));
    }

    private static String estado(TurnoPersonal turno, Set<Long> idsEnCurso) {
        if (turno.getSalida() != null) {
            return COMPLETO;
        }
        return idsEnCurso.contains(turno.getIdTurno()) ? EN_CURSO : SIN_SALIDA;
    }

    private static Set<Long> ids(Collection<TurnoPersonal> turnos) {
        return turnos.stream().map(TurnoPersonal::getIdTurno).collect(Collectors.toSet());
    }

    // Un turno recién cargado o corregido (para la respuesta)
    private Turno turnoDTO(TurnoPersonal turno) {
        LocalDateTime ahora = LocalDateTime.now();
        return turnoDTO(turno, ids(enCursoPorPersona(ahora).values()), correcciones(Set.of(turno.getIdTurno())), ahora);
    }

    private static Turno turnoDTO(TurnoPersonal turno, Set<Long> idsEnCurso, Map<Long, List<Correccion>> correcciones,
                                  LocalDateTime ahora) {
        String estado = estado(turno, idsEnCurso);
        Long minutos = switch (estado) {
            case COMPLETO -> minutosEntre(turno.getEntrada(), turno.getSalida());
            case EN_CURSO -> minutosEntre(turno.getEntrada(), ahora);
            default -> null;
        };
        Usuario persona = turno.getUsuario();
        return new Turno(turno.getIdTurno(), persona.getIdUsuario(), persona.getNombreCompleto(), persona.getRol().name(),
                turno.getEntrada(), turno.getSalida(), minutos, estado, turno.isAnulado(), turno.getOrigen().name(),
                correcciones.getOrDefault(turno.getIdTurno(), List.of()));
    }

    // Correcciones de esos turnos (idTurno -> correcciones de la más vieja a la más nueva)
    private Map<Long, List<Correccion>> correcciones(Collection<Long> idsTurno) {
        if (idsTurno.isEmpty()) {
            return Map.of();
        }
        return correccionRepository.findByTurnoIdTurnoInOrderByFechaAscIdCorreccionAsc(idsTurno).stream()
                .collect(Collectors.groupingBy(c -> c.getTurno().getIdTurno(), Collectors.mapping(
                        c -> new Correccion(c.getFecha(), c.getAutor().getNombreCompleto(), c.getAccion().name(), c.getMotivo(),
                                c.getEntradaAnterior(), c.getSalidaAnterior(), c.getEntradaNueva(), c.getSalidaNueva()),
                        Collectors.toList())));
    }

    // Se guarda antes de cambiar el turno: las horas "anteriores" son las que tiene ahora
    private void registrarCorreccion(TurnoPersonal turno, AccionCorreccion accion, LocalDateTime entradaNueva,
                                     LocalDateTime salidaNueva, String motivo, Usuario autor) {
        boolean alta = accion == AccionCorreccion.ALTA;
        correccionRepository.save(CorreccionTurno.builder()
                .turno(turno)
                .accion(accion)
                .entradaAnterior(alta ? null : turno.getEntrada())
                .salidaAnterior(alta ? null : turno.getSalida())
                .entradaNueva(entradaNueva)
                .salidaNueva(salidaNueva)
                .motivo(motivo)
                .autor(autor)
                .fecha(LocalDateTime.now())
                .build());
    }

    private LogAsistencia registrarLog(Usuario persona, TipoEventoAsistencia tipo, ResultadoAsistencia resultado,
                                       LocalDateTime momento) {
        return logAsistenciaRepository.save(LogAsistencia.builder()
                .usuario(persona)
                .tipoEvento(tipo)
                .resultado(resultado)
                .fechaHora(momento)
                .build());
    }

    // Todo el personal (también el inactivo), por nombre
    private List<Usuario> personal() {
        return ROLES_PERSONAL.stream()
                .flatMap(rol -> usuarioRepository.findByRol(rol).stream())
                .sorted(Comparator.comparing(Usuario::getNombreCompleto, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private Usuario usuario(String email) {
        return usuarioRepository.findByEmail(email).orElseThrow(() -> new NoSuchElementException("Usuario no encontrado"));
    }

    private static String motivo(String texto) {
        String limpio = texto == null ? "" : texto.strip();
        if (limpio.length() < 5) {
            throw new IllegalArgumentException("Escribí el motivo de la corrección (queda registrado)");
        }
        if (limpio.length() > LARGO_MAXIMO_MOTIVO) {
            throw new IllegalArgumentException("El motivo no puede superar los " + LARGO_MAXIMO_MOTIVO + " caracteres");
        }
        return limpio;
    }

    private static boolean mismoMinuto(LocalDateTime a, LocalDateTime b) {
        return a == null || b == null ? a == b : a.truncatedTo(ChronoUnit.MINUTES).equals(b.truncatedTo(ChronoUnit.MINUTES));
    }

    // Minutos entre dos horas sin contar los segundos, como se ven: de 07:58 a 16:03 son 8 h 05 min
    static long minutosEntre(LocalDateTime desde, LocalDateTime hasta) {
        return ChronoUnit.MINUTES.between(desde.truncatedTo(ChronoUnit.MINUTES), hasta.truncatedTo(ChronoUnit.MINUTES));
    }

    // "8 h 05 min", "45 min" o "8 h"
    static String duracion(long minutos) {
        long horas = minutos / 60;
        long resto = minutos % 60;
        if (horas == 0) {
            return resto + " min";
        }
        return resto == 0 ? horas + " h" : horas + " h " + String.format("%02d", resto) + " min";
    }

    // "jue 22/10"
    private static String diaCorto(LocalDateTime momento) {
        return DIAS[momento.getDayOfWeek().getValue() - 1] + " " + momento.format(AsistenciaService.FECHA_CORTA);
    }

    // ---------- Fichas del monitor de recepción ----------

    private static CheckInResponse fichaBase(Usuario persona, LocalDateTime momento) {
        return CheckInResponse.builder()
                .idUsuario(persona.getIdUsuario())
                .nombreSocio(persona.getNombreCompleto())
                .dni(persona.getDni())
                .rol(persona.getRol().name())
                .fechaHora(momento.format(FECHA_HORA))
                .build();
    }

    private static CheckInResponse fichaEntrada(Usuario persona, TurnoPersonal turno, TurnoPersonal sinSalida, LocalDateTime ahora) {
        CheckInResponse ficha = fichaBase(persona, turno.getEntrada());
        ficha.setPermitido(true);
        ficha.setResultado(ResultadoAsistencia.PERMITIDO.name());
        ficha.setMensaje("Entrada registrada");
        ficha.setFichada(ENTRADA);
        ficha.setIdTurno(turno.getIdTurno());
        if (sinSalida != null) {
            ficha.getAvisos().add("Su turno del " + diaCorto(sinSalida.getEntrada()) + " (entró a las "
                    + sinSalida.getEntrada().format(HORA) + ") quedó sin salida: la carga el administrador en Asistencia del personal");
            // Si en realidad se está yendo, recepción la cambia por la salida de ese turno
            LocalDateTime paso = pasoEnRecepcion(turno);
            ficha.setInversionPosible(paso != null && paso.isAfter(ahora.minusMinutes(MINUTOS_PARA_INVERTIR))
                    && cierraEnPlazo(sinSalida, paso));
        }
        return ficha;
    }

    private static CheckInResponse fichaSalida(Usuario persona, TurnoPersonal turno, LocalDateTime ahora) {
        CheckInResponse ficha = fichaBase(persona, turno.getSalida());
        long minutos = minutosEntre(turno.getEntrada(), turno.getSalida());
        ficha.setPermitido(true);
        ficha.setResultado(ResultadoAsistencia.PERMITIDO.name());
        ficha.setMensaje("Salida registrada");
        ficha.setFichada(SALIDA);
        ficha.setIdTurno(turno.getIdTurno());
        ficha.setEntradaTurno(turno.getEntrada());
        ficha.setMinutosTrabajados(minutos);
        // Si en realidad está llegando (con la cuenta activa), recepción la cambia por una entrada
        LocalDateTime paso = pasoEnRecepcion(turno);
        boolean invertible = paso != null && paso.isAfter(ahora.minusMinutes(MINUTOS_PARA_INVERTIR))
                && persona.getEstado() == EstadoUsuario.ACTIVO;
        ficha.setInversionPosible(invertible);
        if (invertible && minutos >= HORAS_TURNO_LARGO * 60L) {
            ficha.getAvisos().add("Turno de " + duracion(minutos) + ": si en realidad está llegando (no había marcado la "
                    + "salida anterior), tocá «Es una entrada»");
        }
        return ficha;
    }

    private static CheckInResponse fichaCuentaInactiva(Usuario persona, LocalDateTime ahora) {
        String falta = "Cuenta " + AsistenciaService.textoEstado(persona.getEstado()) + ": no puede registrar su entrada";
        CheckInResponse ficha = fichaBase(persona, ahora);
        ficha.setPermitido(false);
        ficha.setResultado(ResultadoAsistencia.DENEGADO_CUENTA_INACTIVA.name());
        ficha.setMensaje(falta);
        ficha.getFaltas().add(falta);
        return ficha;
    }
}
