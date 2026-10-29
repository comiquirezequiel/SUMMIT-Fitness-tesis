package com.summit.backend;

import com.summit.backend.dto.CobroRequestDTO;
import com.summit.backend.model.CertificadoMedico;
import com.summit.backend.model.ConfiguracionAcceso;
import com.summit.backend.model.EstadoLegalCertificado;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.LogAsistencia;
import com.summit.backend.model.Plan;
import com.summit.backend.model.ResultadoAsistencia;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Suscripcion;
import com.summit.backend.model.TipoEventoAsistencia;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.CertificadoMedicoRepository;
import com.summit.backend.repository.ConfiguracionAccesoRepository;
import com.summit.backend.repository.LogAsistenciaRepository;
import com.summit.backend.repository.PlanRepository;
import com.summit.backend.repository.SuscripcionRepository;
import com.summit.backend.repository.UsuarioRepository;
import com.summit.backend.security.JwtTokenProvider;
import com.summit.backend.service.ConfiguracionAccesoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

/**
 * Base de los tests de integración: levantan la aplicación entera contra la base summit_test (ver
 * application-test.properties) y cada test corre en una transacción que se deshace al terminar, así los tests no se
 * pisan entre sí. Trae ayudas para armar socios, planes, membresías, aptos e ingresos, y tokens para llamar a la API.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public abstract class PruebaIntegracion {

    private static final AtomicInteger NUMERO = new AtomicInteger();
    protected static final String PASSWORD = "Prueba123";

    @Autowired protected MockMvc mvc;
    @Autowired protected UsuarioRepository usuarioRepository;
    @Autowired protected PlanRepository planRepository;
    @Autowired protected SuscripcionRepository suscripcionRepository;
    @Autowired protected LogAsistenciaRepository logAsistenciaRepository;
    @Autowired protected CertificadoMedicoRepository certificadoMedicoRepository;
    @Autowired protected ConfiguracionAccesoRepository configuracionRepository;
    @Autowired protected ConfiguracionAccesoService configuracionService;
    @Autowired protected JwtTokenProvider jwt;
    @Autowired protected PasswordEncoder passwordEncoder;

    protected static LocalDate hoy() {
        return LocalDate.now();
    }

    /** Un usuario activo, que ya eligió su contraseña (PASSWORD), con DNI y email únicos. */
    protected Usuario usuario(Rol rol) {
        int n = NUMERO.incrementAndGet();
        return usuarioRepository.save(Usuario.builder()
                .dni(String.valueOf(81_000_000 + n))
                .nombreCompleto(rol.name().charAt(0) + rol.name().substring(1).toLowerCase() + " de prueba " + n)
                .email("prueba" + n + "." + rol.name().toLowerCase() + "@test.summit")
                .password(passwordEncoder.encode(PASSWORD))
                .telefono("11 5555-" + String.format("%04d", n % 10000))
                .rol(rol)
                .estado(EstadoUsuario.ACTIVO)
                .debeCambiarPassword(false)
                .build());
    }

    protected Usuario socio() {
        return usuario(Rol.SOCIO);
    }

    /** Plan de 30 días. vecesPorSemana null = pase libre. */
    protected Plan plan(int precio, Integer vecesPorSemana) {
        return planRepository.save(Plan.builder()
                .nombrePlan("Plan prueba " + NUMERO.incrementAndGet())
                .descripcion("De prueba")
                .precioBase(BigDecimal.valueOf(precio))
                .duracionDias(30)
                .vecesPorSemana(vecesPorSemana)
                .activo(true)
                .build());
    }

    protected Suscripcion membresia(Usuario socio, Plan plan, LocalDate vence) {
        return suscripcionRepository.save(Suscripcion.builder()
                .usuario(socio)
                .plan(plan)
                .fechaInicio(vence.minusDays(30))
                .fechaVencimiento(vence)
                .activa(true)
                .build());
    }

    protected CertificadoMedico apto(Usuario socio, LocalDate vence, EstadoLegalCertificado estado) {
        return certificadoMedicoRepository.save(CertificadoMedico.builder()
                .usuario(socio)
                .archivoUrl("prueba/no-existe.pdf")
                .fechaEmision(vence.minusDays(365))
                .fechaVencimiento(vence)
                .estadoLegal(estado)
                .build());
    }

    /** Un socio con la cuota y el apto al día (pase libre). */
    protected Usuario socioAlDia() {
        Usuario socio = socio();
        membresia(socio, plan(10000, null), hoy().plusDays(20));
        apto(socio, hoy().plusDays(200), EstadoLegalCertificado.VIGENTE);
        return socio;
    }

    /** Un ingreso permitido registrado en ese momento. */
    protected void ingreso(Usuario socio, LocalDateTime cuando) {
        logAsistenciaRepository.save(LogAsistencia.builder()
                .usuario(socio)
                .tipoEvento(TipoEventoAsistencia.INGRESO_MOLINETE)
                .resultado(ResultadoAsistencia.PERMITIDO)
                .fechaHora(cuando)
                .build());
    }

    /** Cambia las reglas de acceso solo para este test (se deshace al terminar). */
    protected void reglasDeAcceso(Consumer<ConfiguracionAcceso> cambio) {
        ConfiguracionAcceso config = configuracionService.obtenerConfiguracionGlobal();
        cambio.accept(config);
        configuracionRepository.save(config);
    }

    protected String token(Usuario usuario) {
        return "Bearer " + jwt.generateToken(usuario.getEmail(), usuario.getRol().name());
    }

    /** Pedido de cobro en efectivo con el total que se le mostró a recepción. */
    protected static CobroRequestDTO cobro(Usuario socio, Plan plan, int totalMostrado) {
        CobroRequestDTO pedido = new CobroRequestDTO();
        pedido.setIdUsuario(socio.getIdUsuario());
        pedido.setIdPlan(plan.getIdPlan());
        pedido.setMetodoPago("EFECTIVO");
        pedido.setTotalMostrado(BigDecimal.valueOf(totalMostrado));
        return pedido;
    }
}
