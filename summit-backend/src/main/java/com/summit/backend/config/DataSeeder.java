package com.summit.backend.config;

import com.summit.backend.model.Ejercicio;
import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.GrupoMuscular;
import com.summit.backend.model.Plan;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.EjercicioRepository;
import com.summit.backend.repository.PlanRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * Carga los datos mínimos para que el sistema sea usable en una instalación nueva.
 * Es idempotente: solo crea lo que falta y nunca modifica datos existentes.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements ApplicationRunner {

    private final UsuarioRepository usuarioRepository;
    private final PlanRepository planRepository;
    private final EjercicioRepository ejercicioRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${summit.seed.admin.email}")
    private String adminEmail;

    @Value("${summit.seed.admin.password}")
    private String adminPassword;

    @Value("${summit.seed.admin.dni}")
    private String adminDni;

    @Override
    public void run(ApplicationArguments args) {
        crearAdminInicial();
        crearPlanesBase();
        crearEjerciciosBase();
    }

    /**
     * El registro público solo crea socios, así que sin este admin
     * no habría forma de entrar al panel en una base vacía.
     */
    private void crearAdminInicial() {
        if (usuarioRepository.existsByRol(Rol.ADMIN)) {
            return;
        }
        if (usuarioRepository.existsByEmail(adminEmail) || usuarioRepository.existsByDni(adminDni)) {
            log.warn("No se creó el admin inicial: el email {} o el DNI {} ya están en uso por otro usuario", adminEmail, adminDni);
            return;
        }

        usuarioRepository.save(Usuario.builder()
                .dni(adminDni)
                .nombreCompleto("Administrador")
                .email(adminEmail)
                .password(passwordEncoder.encode(adminPassword))
                .rol(Rol.ADMIN)
                .estado(EstadoUsuario.ACTIVO)
                .build());
        log.warn("Se creó el admin inicial {} con la contraseña de summit.seed.admin.password. Cambiala después del primer login.", adminEmail);
    }

    /**
     * Planes de la tesis: Pase Libre, 3 veces por semana y 2 veces por semana.
     * Los precios son de referencia y se editan desde la gestión de planes.
     */
    private void crearPlanesBase() {
        crearPlanSiNoExiste("Pase Libre", "Acceso libre todos los días.", "25000", null);
        crearPlanSiNoExiste("3 veces por semana", "Hasta 3 días de acceso por semana.", "20000", 3);
        crearPlanSiNoExiste("2 veces por semana", "Hasta 2 días de acceso por semana.", "16000", 2);
    }

    private void crearPlanSiNoExiste(String nombre, String descripcion, String precio, Integer vecesPorSemana) {
        if (planRepository.existsByNombrePlan(nombre)) {
            return;
        }
        planRepository.save(Plan.builder()
                .nombrePlan(nombre)
                .descripcion(descripcion)
                .precioBase(new BigDecimal(precio))
                .duracionDias(30)
                .vecesPorSemana(vecesPorSemana)
                .activo(true)
                .build());
        log.info("Plan base creado: {}", nombre);
    }

    /**
     * Catálogo básico para el constructor de rutinas, solo si todavía no hay ningún ejercicio
     * (si el gimnasio ya cargó los suyos, no se toca). Las contraindicaciones se cruzan
     * con las patologías del certificado médico del socio.
     */
    private void crearEjerciciosBase() {
        if (ejercicioRepository.count() > 0) {
            return;
        }
        List<Ejercicio> catalogo = List.of(
                ejercicio("Press de banca plano", GrupoMuscular.PECHO, "pecho-medio", "HOMBRO",
                        "Acostado en el banco, bajar la barra hasta el pecho y empujar hasta extender los brazos."),
                ejercicio("Press inclinado con mancuernas", GrupoMuscular.PECHO, "pecho-superior", "HOMBRO",
                        "Banco a 30-45 grados; bajar las mancuernas a los costados del pecho y empujar."),
                ejercicio("Dominadas", GrupoMuscular.ESPALDA, "dorsales-anchos", "HOMBRO",
                        "Colgado de la barra con agarre prono, subir hasta pasar el mentón por encima."),
                ejercicio("Jalón al pecho en polea", GrupoMuscular.ESPALDA, "dorsales-anchos", null,
                        "Sentado, llevar la barra hacia el pecho juntando los omóplatos."),
                ejercicio("Remo con barra", GrupoMuscular.ESPALDA, "espalda-alta", "HERNIA,LUMBAR",
                        "Torso inclinado y espalda neutra; llevar la barra hacia el abdomen."),
                ejercicio("Curl de bíceps con barra", GrupoMuscular.BICEPS, "cabeza-corta", null,
                        "De pie, flexionar los codos sin balancear el torso."),
                ejercicio("Curl martillo con mancuernas", GrupoMuscular.BICEPS, "antebrazo-braquiorradial", null,
                        "Agarre neutro (palmas enfrentadas), flexionar alternando los brazos."),
                ejercicio("Fondos en paralelas", GrupoMuscular.TRICEPS, "triceps-lateral", "HOMBRO",
                        "Bajar flexionando los codos hasta 90 grados y empujar hasta extenderlos."),
                ejercicio("Extensión de tríceps en polea", GrupoMuscular.TRICEPS, "triceps-lateral", null,
                        "Codos pegados al cuerpo; extender los brazos hacia abajo."),
                ejercicio("Press militar con barra", GrupoMuscular.HOMBROS, "deltoide-frontal", "HOMBRO,CERVICAL,LUMBAR",
                        "De pie, empujar la barra desde los hombros hasta arriba de la cabeza."),
                ejercicio("Elevaciones laterales con mancuernas", GrupoMuscular.HOMBROS, "deltoide-lateral", null,
                        "Elevar los brazos a los costados hasta la altura de los hombros."),
                ejercicio("Sentadilla con barra", GrupoMuscular.CUADRICEPS, "cuadriceps", "RODILLA,HERNIA,LUMBAR",
                        "Barra sobre la espalda alta; bajar hasta que los muslos queden paralelos al piso."),
                ejercicio("Prensa de piernas", GrupoMuscular.CUADRICEPS, "cuadriceps", "RODILLA,HERNIA",
                        "Empujar la plataforma sin bloquear las rodillas ni despegar la cadera del asiento."),
                ejercicio("Extensión de cuádriceps en máquina", GrupoMuscular.CUADRICEPS, "cuadriceps", "RODILLA",
                        "Sentado, extender las rodillas y bajar controlando el peso."),
                ejercicio("Peso muerto rumano", GrupoMuscular.ISQUIOS, "isquiotibiales", "HERNIA,LUMBAR",
                        "Rodillas apenas flexionadas; bajar la barra pegada a las piernas con la espalda neutra."),
                ejercicio("Curl femoral acostado", GrupoMuscular.ISQUIOS, "isquiotibiales", null,
                        "Boca abajo en la máquina, flexionar las rodillas llevando los talones a los glúteos."),
                ejercicio("Hip thrust con barra", GrupoMuscular.GLUTEOS, "gluteo", "LUMBAR",
                        "Espalda apoyada en el banco; elevar la cadera apretando los glúteos."),
                ejercicio("Elevación de talones de pie", GrupoMuscular.PANTORRILLAS, "gemelos", null,
                        "Subir en puntas de pie y bajar lento hasta estirar los gemelos."),
                ejercicio("Crunch abdominal", GrupoMuscular.ABDOMINALES, "recto-abdominal", "HERNIA,CERVICAL",
                        "Acostado boca arriba, despegar los hombros del piso sin tirar del cuello."),
                ejercicio("Plancha frontal", GrupoMuscular.CORE, "recto-abdominal", null,
                        "Apoyado en antebrazos y puntas de pie, mantener el cuerpo recto (se indica en segundos).")
        );
        ejercicioRepository.saveAll(catalogo);
        log.info("Catálogo base de ejercicios creado: {} ejercicios", catalogo.size());
    }

    private static Ejercicio ejercicio(String nombre, GrupoMuscular grupo, String svgTargetId,
                                       String contraindicaciones, String descripcion) {
        return Ejercicio.builder()
                .nombre(nombre)
                .grupoMuscular(grupo)
                .svgTargetId(svgTargetId)
                .patologiasContraindicadas(contraindicaciones)
                .descripcion(descripcion)
                .build();
    }
}
