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
        // Sin contraseña no se crea: el login la exige, así que ese admin no podría entrar nunca, y como ya
        // existiría, cargar ADMIN_PASSWORD después no lo arreglaría.
        if (adminPassword.isBlank()) {
            log.warn("No se creó el admin inicial: falta ADMIN_PASSWORD en application-local.properties (ver README)");
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
                // ADMIN_PASSWORD queda escrita en un archivo: al entrar por primera vez la tiene que cambiar
                .debeCambiarPassword(true)
                .build());
        log.warn("Se creó el admin inicial {} con la contraseña de summit.seed.admin.password: al entrar por primera vez pide cambiarla.", adminEmail);
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
     * Catálogo básico para el constructor de rutinas y el modelo anatómico.
     * Es idempotente por ejercicio: agrega los ejercicios base que falten en la base
     * y completa urlMedia / svgTargetId en los existentes si estaban vacíos.
     * Las contraindicaciones se cruzan con las patologías del certificado médico del socio.
     */
    private void crearEjerciciosBase() {
        List<Ejercicio> catalogo = List.of(
                ejercicio("Press de banca plano", GrupoMuscular.PECHO, "pecho-medio", "HOMBRO",
                        "Acostado en el banco, bajar la barra hasta el pecho y empujar hasta extender los brazos.", null),
                ejercicio("Press inclinado con mancuernas", GrupoMuscular.PECHO, "pecho-superior", "HOMBRO",
                        "Banco a 30-45 grados; bajar las mancuernas a los costados del pecho y empujar.", null),
                ejercicio("Dominadas", GrupoMuscular.ESPALDA, "dorsales-anchos", "HOMBRO",
                        "Colgado de la barra con agarre prono, subir hasta pasar el mentón por encima.", null),
                ejercicio("Jalón al pecho en polea", GrupoMuscular.ESPALDA, "dorsales-anchos", null,
                        "Sentado, llevar la barra hacia el pecho juntando los omóplatos.", null),
                ejercicio("Remo con barra", GrupoMuscular.ESPALDA, "espalda-alta", "HERNIA,LUMBAR",
                        "Torso inclinado y espalda neutra; llevar la barra hacia el abdomen.", null),
                ejercicio("Curl de bíceps con barra", GrupoMuscular.BICEPS, "cabeza-corta", null,
                        "De pie, flexionar los codos sin balancear el torso.", null),
                ejercicio("Curl martillo con mancuernas", GrupoMuscular.BICEPS, "antebrazo-braquiorradial", null,
                        "Agarre neutro (palmas enfrentadas), flexionar alternando los brazos.", null),
                ejercicio("Fondos en paralelas", GrupoMuscular.TRICEPS, "triceps-lateral", "HOMBRO",
                        "Bajar flexionando los codos hasta 90 grados y empujar hasta extenderlos.", null),
                ejercicio("Extensión de tríceps en polea", GrupoMuscular.TRICEPS, "triceps-lateral", null,
                        "Codos pegados al cuerpo; extender los brazos hacia abajo.", null),
                ejercicio("Press francés con barra", GrupoMuscular.TRICEPS, "triceps-larga", "HOMBRO",
                        "Acostado en banco plano, bajar la barra hacia la frente flexionando los codos sin abrirlos y volver a extender.",
                        "/gym-exercises/press_frances_con_barra_triceps.gif"),
                ejercicio("Fondos en banco para tríceps", GrupoMuscular.TRICEPS, "triceps-medial", "HOMBRO",
                        "Con las manos apoyadas en el borde de un banco detrás de la espalda, bajar flexionando los codos y empujar hasta extenderlos.",
                        "/gym-exercises/fondos_en_banco_triceps.gif"),
                ejercicio("Press militar con barra", GrupoMuscular.HOMBROS, "deltoide-frontal", "HOMBRO,CERVICAL,LUMBAR",
                        "De pie, empujar la barra desde los hombros hasta arriba de la cabeza.", null),
                ejercicio("Elevaciones laterales con mancuernas", GrupoMuscular.HOMBROS, "deltoide-lateral", null,
                        "Elevar los brazos a los costados hasta la altura de los hombros.", null),
                ejercicio("Sentadilla con barra", GrupoMuscular.CUADRICEPS, "cuadriceps", "RODILLA,HERNIA,LUMBAR",
                        "Barra sobre la espalda alta; bajar hasta que los muslos queden paralelos al piso.", null),
                ejercicio("Sentadilla con mancuernas", GrupoMuscular.CUADRICEPS, "cuadriceps", "RODILLA,HERNIA,LUMBAR",
                        "De pie con una mancuerna en cada mano a los costados, bajar flexionando rodillas y cadera con la espalda recta.",
                        "/gym-exercises/sentadilla_con_mancuernas.gif"),
                ejercicio("Prensa de piernas", GrupoMuscular.CUADRICEPS, "cuadriceps", "RODILLA,HERNIA",
                        "Empujar la plataforma sin bloquear las rodillas ni despegar la cadera del asiento.", null),
                ejercicio("Extensión de cuádriceps en máquina", GrupoMuscular.CUADRICEPS, "cuadriceps", "RODILLA",
                        "Sentado, extender las rodillas y bajar controlando el peso.",
                        "/gym-exercises/extension_de_cuadriceps_en_maquina.gif"),
                ejercicio("Aducción en máquina", GrupoMuscular.CUADRICEPS, "aductores", null,
                        "En la máquina de aductores, llevar la pierna hacia adentro cruzando la línea media con movimiento controlado.",
                        "/gym-exercises/aduccion_maquina.gif"),
                ejercicio("Air Bike (Bicicleta de aire)", GrupoMuscular.CUADRICEPS, "cuadriceps", "RODILLA",
                        "Pedalear y empujar los brazos de la bicicleta de aire en simultáneo manteniendo el torso erguido.",
                        "/gym-exercises/air_bike.gif"),
                ejercicio("Peso muerto rumano", GrupoMuscular.ISQUIOS, "isquiotibiales", "HERNIA,LUMBAR",
                        "Rodillas apenas flexionadas; bajar la barra pegada a las piernas con la espalda neutra.", null),
                ejercicio("Peso muerto con barra", GrupoMuscular.ISQUIOS, "isquiotibiales", "HERNIA,LUMBAR",
                        "De pie frente a la barra, tomarla con agarre firme y levantarla extendiendo cadera y rodillas con la espalda neutra.",
                        "/gym-exercises/peso_muerto_con_barra.gif"),
                ejercicio("Curl femoral acostado", GrupoMuscular.ISQUIOS, "isquiotibiales", null,
                        "Boca abajo en la máquina, flexionar las rodillas llevando los talones a los glúteos.", null),
                ejercicio("Hip thrust con barra", GrupoMuscular.GLUTEOS, "gluteo", "LUMBAR",
                        "Espalda apoyada en el banco; elevar la cadera apretando los glúteos.", null),
                ejercicio("Abducción de cadera en polea", GrupoMuscular.GLUTEOS, "abductores", null,
                        "De pie junto a la polea baja con tobillera, separar la pierna hacia el costado manteniendo el torso firme.",
                        "/gym-exercises/abduccion_cable.gif"),
                ejercicio("Elevación de talones de pie", GrupoMuscular.PANTORRILLAS, "gemelos", null,
                        "Subir en puntas de pie y bajar lento hasta estirar los gemelos.", null),
                ejercicio("Extensión de gemelos en prensa", GrupoMuscular.PANTORRILLAS, "gemelos", null,
                        "En la prensa de piernas, apoyar la punta de los pies en el borde de la plataforma y empujar extendiendo los tobillos.",
                        "/gym-exercises/extension_de_gemelos_en_prensa.gif"),
                ejercicio("Crunch abdominal", GrupoMuscular.ABDOMINALES, "recto-abdominal", "HERNIA,CERVICAL",
                        "Acostado boca arriba, despegar los hombros del piso sin tirar del cuello.", null),
                ejercicio("Abdominales en V con mancuerna", GrupoMuscular.ABDOMINALES, "recto-abdominal", "HERNIA,LUMBAR",
                        "Acostado boca arriba con una mancuerna en las manos, elevar al mismo tiempo el torso y las piernas extendidas formando una V.",
                        "/gym-exercises/abdominales_en_v_con_mancuerna.gif"),
                ejercicio("Plancha frontal", GrupoMuscular.CORE, "recto-abdominal", null,
                        "Apoyado en antebrazos y puntas de pie, mantener el cuerpo recto (se indica en segundos).", null)
        );
        int creados = 0;
        int actualizados = 0;
        for (Ejercicio base : catalogo) {
            var existenteOpt = ejercicioRepository.findByNombreIgnoreCase(base.getNombre());
            if (existenteOpt.isEmpty()) {
                ejercicioRepository.save(base);
                creados++;
            } else {
                Ejercicio existente = existenteOpt.get();
                boolean cambio = false;
                if ((existente.getUrlMedia() == null || existente.getUrlMedia().isBlank()) && base.getUrlMedia() != null) {
                    existente.setUrlMedia(base.getUrlMedia());
                    cambio = true;
                }
                if ((existente.getSvgTargetId() == null || existente.getSvgTargetId().isBlank()) && base.getSvgTargetId() != null) {
                    existente.setSvgTargetId(base.getSvgTargetId());
                    cambio = true;
                }
                if (cambio) {
                    ejercicioRepository.save(existente);
                    actualizados++;
                }
            }
        }
        if (creados > 0 || actualizados > 0) {
            log.info("Catálogo base de ejercicios sincronizado: {} nuevos, {} actualizados con media", creados, actualizados);
        }
    }

    private static Ejercicio ejercicio(String nombre, GrupoMuscular grupo, String svgTargetId,
                                       String contraindicaciones, String descripcion, String urlMedia) {
        return Ejercicio.builder()
                .nombre(nombre)
                .grupoMuscular(grupo)
                .svgTargetId(svgTargetId)
                .patologiasContraindicadas(contraindicaciones)
                .descripcion(descripcion)
                .urlMedia(urlMedia)
                .build();
    }
}
