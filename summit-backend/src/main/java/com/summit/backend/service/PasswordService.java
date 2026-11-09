package com.summit.backend.service;

import com.summit.backend.model.EstadoUsuario;
import com.summit.backend.model.RecuperacionPassword;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.RecuperacionPasswordRepository;
import com.summit.backend.repository.UsuarioRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Contraseñas (fase 6 del desarrollo): cambiar la propia, restablecerla con una temporal (recepción o el admin) y
 * recuperarla por email con un link de un solo uso.
 *
 * <p>Cada cambio deja sin efecto los tokens emitidos antes (JwtAuthenticationFilter compara con passwordCambiada).</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordService {

    private static final int LARGO_MINIMO = 8;
    private static final int LARGO_MAXIMO = 100;
    private static final int LARGO_TEMPORAL = 10;
    // Para la temporal: sin caracteres que se confunden al dictarla o leerla (0/O, 1/l/I)
    private static final String LETRAS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String NUMEROS = "23456789";
    // Para que nadie use "¿Olvidaste tu contraseña?" para llenarle la casilla a otro
    private static final Duration ESPERA_ENTRE_MAILS = Duration.ofMinutes(2);

    private final UsuarioRepository usuarioRepository;
    private final RecuperacionPasswordRepository recuperacionRepository;
    private final PasswordEncoder passwordEncoder;
    private final DatosGimnasioService datosGimnasioService;
    // Spring lo arma con spring.mail.* (MAIL_HOST y compañía)
    private final ObjectProvider<JavaMailSender> correo;
    private final SecureRandom azar = new SecureRandom();

    // Dirección del panel: la del link del mail. Sale de la configuración y nunca del pedido, porque
    // si no, alguien podría pedir el link para otro con una dirección suya y quedarse con el token.
    @Value("${summit.app.url:}")
    private String urlApp;

    @Value("${summit.recuperacion.minutos:30}")
    private long minutosRecuperacion;

    @Value("${summit.mail.remitente:}")
    private String remitente;

    @Value("${spring.mail.username:}")
    private String usuarioCorreo;

    /** El link que llega por email ya no sirve (usado, vencido o inexistente). */
    public static class LinkInvalidoException extends IllegalArgumentException {
        public LinkInvalidoException() {
            super("El link ya no sirve: pedí uno nuevo desde \"¿Olvidaste tu contraseña?\"");
        }
    }

    /** No hay correo configurado: la contraseña la restablece recepción o el admin. */
    public static class RecuperacionNoDisponibleException extends RuntimeException {
        public RecuperacionNoDisponibleException() {
            super("La recuperación por email no está disponible: pedile a recepción que te restablezca la contraseña");
        }
    }

    /**
     * Reglas de una contraseña elegida por el usuario: al menos 8 caracteres, con letras y números.
     *
     * @throws IllegalArgumentException con el motivo, para mostrarlo
     */
    public static void validarNueva(String nueva) {
        if (nueva == null || nueva.length() < LARGO_MINIMO || !nueva.matches(".*\\p{L}.*") || !nueva.matches(".*\\d.*")) {
            throw new IllegalArgumentException("La contraseña nueva tiene que tener al menos " + LARGO_MINIMO + " caracteres, con letras y números");
        }
        if (nueva.length() > LARGO_MAXIMO) {
            throw new IllegalArgumentException("La contraseña puede tener hasta " + LARGO_MAXIMO + " caracteres");
        }
    }

    /**
     * Cambia la propia contraseña, pidiendo la actual.
     *
     * @throws IllegalArgumentException si la actual no coincide o la nueva no sirve
     */
    @Transactional
    public Usuario cambiar(String email, String actual, String nueva) {
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new NoSuchElementException("Usuario no encontrado"));
        if (actual == null || !passwordEncoder.matches(actual, usuario.getPassword())) {
            throw new IllegalArgumentException("La contraseña actual no es correcta");
        }
        validarNueva(nueva);
        if (passwordEncoder.matches(nueva, usuario.getPassword())) {
            throw new IllegalArgumentException("La contraseña nueva tiene que ser distinta de la actual");
        }
        guardar(usuario, nueva, false);
        return usuario;
    }

    /**
     * Le pone una contraseña temporal (para dársela en persona): al entrar tiene que cambiarla. Devuelve la
     * temporal, que no se guarda en ningún lado salvo su hash.
     */
    @Transactional
    public String restablecerConTemporal(Usuario usuario) {
        String temporal = temporalNueva();
        guardar(usuario, temporal, true);
        return temporal;
    }

    /**
     * Una contraseña al azar para la ficha de un socio: los socios no entran al sistema, así que nadie la conoce.
     */
    public String alAzar() {
        return temporalNueva();
    }

    /** Si se puede ofrecer "¿Olvidaste tu contraseña?": hay correo saliente y se sabe la dirección del panel. */
    public boolean recuperacionDisponible() {
        return enviador() != null;
    }

    /**
     * "¿Olvidaste tu contraseña?": si el email es de una cuenta activa, le manda un link de un solo uso. Por
     * fuera responde siempre igual, así no se puede averiguar qué emails están registrados.
     *
     * @throws RecuperacionNoDisponibleException si no hay correo configurado
     */
    @Transactional
    public void solicitarRecuperacion(String email) {
        JavaMailSender enviador = enviador();
        if (enviador == null) {
            throw new RecuperacionNoDisponibleException();
        }
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Escribí tu email");
        }
        // Los socios no entran al sistema: solo el personal recupera su contraseña
        Optional<Usuario> cuenta = usuarioRepository.findByEmail(email.trim())
                .filter(u -> u.getEstado() == EstadoUsuario.ACTIVO)
                .filter(u -> u.getRol() != Rol.SOCIO);
        if (cuenta.isEmpty()) {
            return;
        }
        Usuario usuario = cuenta.get();
        LocalDateTime ahora = LocalDateTime.now();
        boolean pidioRecien = recuperacionRepository.findFirstByUsuarioIdUsuarioOrderByCreadaDesc(usuario.getIdUsuario())
                .map(r -> r.getCreada().isAfter(ahora.minus(ESPERA_ENTRE_MAILS)))
                .orElse(false);
        if (pidioRecien) {
            return;
        }
        recuperacionRepository.anularPendientes(usuario.getIdUsuario(), ahora);
        byte[] bytes = new byte[32];
        azar.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        recuperacionRepository.save(RecuperacionPassword.builder()
                .usuario(usuario)
                .hashToken(huella(token))
                .creada(ahora)
                .vence(ahora.plusMinutes(minutosRecuperacion))
                .build());
        MimeMessage mensaje = armarMail(enviador, usuario, token);
        if (mensaje != null) {
            // Sale cuando el pedido ya quedó guardado, y aparte: así la respuesta tarda lo mismo exista o no la cuenta
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    CompletableFuture.runAsync(() -> {
                        try {
                            enviador.send(mensaje);
                        } catch (RuntimeException e) {
                            log.warn("No se pudo mandar el mail de recuperación de contraseña", e);
                        }
                    });
                }
            });
        }
    }

    /**
     * Elige una contraseña nueva con el link del email. Devuelve el email de la cuenta (para entrar).
     *
     * @throws LinkInvalidoException si el link se usó, venció o no existe
     * @throws IllegalArgumentException si la contraseña nueva no sirve
     */
    @Transactional
    public String restablecerConToken(String token, String nueva) {
        RecuperacionPassword pedido = token == null || token.isBlank()
                ? null
                : recuperacionRepository.findByHashToken(huella(token)).orElse(null);
        if (pedido == null || pedido.getUsada() != null || pedido.getVence().isBefore(LocalDateTime.now())
                || pedido.getUsuario().getEstado() != EstadoUsuario.ACTIVO) {
            throw new LinkInvalidoException();
        }
        validarNueva(nueva);
        pedido.setUsada(LocalDateTime.now());
        guardar(pedido.getUsuario(), nueva, false);
        return pedido.getUsuario().getEmail();
    }

    /** Todas las madrugadas borra los pedidos de recuperación de hace más de 7 días. */
    @Scheduled(cron = "0 45 3 * * ?")
    @Transactional
    public void limpiar() {
        int borrados = recuperacionRepository.borrarAnterioresA(LocalDateTime.now().minusDays(7));
        if (borrados > 0) {
            log.info("Pedidos de recuperación de contraseña viejos borrados: {}", borrados);
        }
    }

    // Guarda la contraseña y anula los links de recuperación pendientes
    private void guardar(Usuario usuario, String password, boolean temporal) {
        // En segundos, como la fecha de emisión de los tokens: el token que se da enseguida no queda viejo
        LocalDateTime ahora = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        usuario.setPassword(passwordEncoder.encode(password));
        usuario.setDebeCambiarPassword(temporal);
        usuario.setPasswordCambiada(ahora);
        usuarioRepository.save(usuario);
        recuperacionRepository.anularPendientes(usuario.getIdUsuario(), ahora);
    }

    // 10 caracteres, con al menos una letra y un número
    private String temporalNueva() {
        String caracteres = LETRAS + NUMEROS;
        while (true) {
            StringBuilder temporal = new StringBuilder();
            for (int i = 0; i < LARGO_TEMPORAL; i++) {
                temporal.append(caracteres.charAt(azar.nextInt(caracteres.length())));
            }
            String candidata = temporal.toString();
            if (candidata.chars().anyMatch(c -> LETRAS.indexOf(c) >= 0) && candidata.chars().anyMatch(c -> NUMEROS.indexOf(c) >= 0)) {
                return candidata;
            }
        }
    }

    // null si falta configurar el correo (MAIL_HOST) o la dirección del panel (APP_URL). Spring arma el enviador
    // aunque MAIL_HOST esté vacío, así que no alcanza con que exista.
    private JavaMailSender enviador() {
        JavaMailSender enviador = correo.getIfAvailable();
        if (enviador == null || !StringUtils.hasText(urlApp)
                || (enviador instanceof JavaMailSenderImpl impl && !StringUtils.hasText(impl.getHost()))) {
            return null;
        }
        return enviador;
    }

    private MimeMessage armarMail(JavaMailSender enviador, Usuario usuario, String token) {
        String link = urlApp.strip().replaceAll("/+$", "") + "/restablecer?token=" + token;
        String nombre = usuario.getNombreCompleto().trim().split("\\s+")[0];
        String gimnasio = datosGimnasioService.obtener().getNombre();
        String texto = "Hola " + nombre + ":\n\n"
                + "Para elegir una contraseña nueva, entrá a este link. Sirve una sola vez y vence en "
                + minutosRecuperacion + " minutos:\n\n" + link + "\n\n"
                + "Si no lo pediste vos, ignorá este mail: tu contraseña sigue igual.\n\n" + gimnasio;
        String html = "<p>Hola " + escapar(nombre) + ":</p>"
                + "<p>Para elegir una contraseña nueva, tocá el botón. Sirve una sola vez y vence en "
                + minutosRecuperacion + " minutos.</p>"
                + "<p><a href=\"" + link + "\" style=\"display:inline-block;padding:12px 20px;background:#6B1027;"
                + "color:#ffffff;border-radius:10px;text-decoration:none;font-weight:bold\">Elegir contraseña nueva</a></p>"
                + "<p style=\"color:#64748b;font-size:13px\">Si el botón no funciona, copiá este link: " + link + "</p>"
                + "<p style=\"color:#64748b;font-size:13px\">Si no lo pediste vos, ignorá este mail: tu contraseña sigue igual.</p>"
                + "<p>" + escapar(gimnasio) + "</p>";
        try {
            MimeMessage mensaje = enviador.createMimeMessage();
            MimeMessageHelper ayuda = new MimeMessageHelper(mensaje, true, "UTF-8");
            ayuda.setTo(usuario.getEmail());
            ayuda.setFrom(remitente(), gimnasio);
            ayuda.setSubject("Elegí una contraseña nueva para " + gimnasio);
            ayuda.setText(texto, html);
            return mensaje;
        } catch (MessagingException | UnsupportedEncodingException e) {
            log.warn("No se pudo armar el mail de recuperación de contraseña", e);
            return null;
        }
    }

    // MAIL_REMITENTE o, si no está, la cuenta con la que se entra al correo (Gmail no deja mandar con otra)
    private String remitente() {
        if (StringUtils.hasText(remitente)) {
            return remitente.strip();
        }
        return usuarioCorreo.contains("@") ? usuarioCorreo.strip() : "no-responder@summit.local";
    }

    // SHA-256 en hexadecimal: lo único que se guarda del token del link
    private static String huella(String token) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("La JVM no tiene SHA-256", e);
        }
    }

    private static String escapar(String texto) {
        return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
