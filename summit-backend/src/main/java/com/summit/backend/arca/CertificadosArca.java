package com.summit.backend.arca;

import com.summit.backend.model.AmbienteArca;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.asn1.x500.RDN;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x500.style.BCStyle;
import org.bouncycastle.asn1.x500.style.IETFUtils;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.UnrecoverableKeyException;
import java.security.cert.CertificateEncodingException;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.Date;
import java.util.HexFormat;

/**
 * El certificado del gimnasio para ARCA: un archivo .p12 (certificado + clave privada) fuera del repositorio, con su
 * contraseña en application-local.properties. En el ambiente SIMULADOR, si no hay archivo, se usa uno de mentira que se
 * genera al arrancar (el simulador no pide uno emitido por ARCA).
 */
@Component
@Slf4j
public class CertificadosArca {

    /** Certificado cargado. cuit sale del serialNumber del sujeto ("CUIT 20123456789"); null si no tiene. */
    public record CertificadoArca(PrivateKey clave, X509Certificate certificado, String huella, String cuit,
                                  boolean deMentira) {
        public Instant vence() {
            return certificado.getNotAfter().toInstant();
        }
    }

    private final ConfiguracionArca config;
    private volatile CertificadoArca cargado;

    public CertificadosArca(ConfiguracionArca config) {
        this.config = config;
    }

    /** El certificado con el que se firman los pedidos a ARCA (se lee una sola vez). */
    public CertificadoArca actual() throws ArcaException {
        CertificadoArca c = cargado;
        if (c == null) {
            synchronized (this) {
                if (cargado == null) {
                    cargado = cargar();
                }
                c = cargado;
            }
        }
        return c;
    }

    /** Para volver a leer el archivo (por ejemplo después de renovarlo) sin reiniciar el backend. */
    public synchronized void olvidar() {
        cargado = null;
    }

    private CertificadoArca cargar() throws ArcaException {
        if (config.certificado().isEmpty()) {
            if (config.ambiente() == AmbienteArca.SIMULADOR) {
                return deMentira();
            }
            throw new ArcaException("CERTIFICADO", "Falta el certificado de ARCA: poné la ruta del archivo .p12 en "
                    + "ARCA_CERTIFICADO (application-local.properties) y reiniciá el backend", false);
        }
        Path ruta = Path.of(config.certificado());
        try (InputStream entrada = Files.newInputStream(ruta)) {
            KeyStore almacen = KeyStore.getInstance("PKCS12");
            char[] password = config.certificadoPassword().toCharArray();
            almacen.load(entrada, password);
            for (String alias : Collections.list(almacen.aliases())) {
                if (almacen.isKeyEntry(alias)) {
                    PrivateKey clave = (PrivateKey) almacen.getKey(alias, password);
                    X509Certificate certificado = (X509Certificate) almacen.getCertificate(alias);
                    return new CertificadoArca(clave, certificado, huella(certificado), cuitDe(certificado), false);
                }
            }
            throw new ArcaException("CERTIFICADO", "El archivo " + ruta.getFileName()
                    + " no tiene la clave privada: armalo con el certificado y la clave juntos (ver FACTURACION.md)", false);
        } catch (NoSuchFileException e) {
            throw new ArcaException("CERTIFICADO", "No se encuentra el certificado en " + ruta, false, e);
        } catch (UnrecoverableKeyException e) {
            throw new ArcaException("CERTIFICADO", "La contraseña del certificado no es la correcta (ARCA_CERTIFICADO_PASSWORD)", false, e);
        } catch (IOException e) {
            // KeyStore.load avisa así una contraseña equivocada
            String detalle = e.getCause() instanceof UnrecoverableKeyException || String.valueOf(e.getMessage()).contains("password")
                    ? "la contraseña no es la correcta (ARCA_CERTIFICADO_PASSWORD)" : e.getMessage();
            throw new ArcaException("CERTIFICADO", "No se pudo leer el certificado: " + detalle, false, e);
        } catch (GeneralSecurityException e) {
            throw new ArcaException("CERTIFICADO", "No se pudo leer el certificado: " + e.getMessage(), false, e);
        }
    }

    // Certificado autofirmado para el simulador: nunca sirve contra ARCA
    private static CertificadoArca deMentira() throws ArcaException {
        try {
            KeyPairGenerator generador = KeyPairGenerator.getInstance("RSA");
            generador.initialize(2048);
            KeyPair par = generador.generateKeyPair();
            X500Name sujeto = new X500Name("CN=SUMMIT simulador, O=SUMMIT");
            Instant ahora = Instant.now();
            X509Certificate certificado = new JcaX509CertificateConverter().getCertificate(new JcaX509v3CertificateBuilder(
                    sujeto, BigInteger.valueOf(ahora.toEpochMilli()), Date.from(ahora.minus(Duration.ofDays(1))),
                    Date.from(ahora.plus(Duration.ofDays(730))), sujeto, par.getPublic())
                    .build(new JcaContentSignerBuilder("SHA256withRSA").build(par.getPrivate())));
            log.info("Facturación en modo simulador: se usa un certificado de mentira (no sirve contra ARCA)");
            return new CertificadoArca(par.getPrivate(), certificado, huella(certificado), null, true);
        } catch (Exception e) {
            throw new ArcaException("CERTIFICADO", "No se pudo generar el certificado del simulador: " + e.getMessage(), false, e);
        }
    }

    private static String huella(X509Certificate certificado) throws GeneralSecurityException {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(certificado.getEncoded()));
    }

    // ARCA pone la CUIT en el serialNumber del sujeto: "serialNumber=CUIT 20123456789"
    private static String cuitDe(X509Certificate certificado) {
        try {
            for (RDN rdn : new JcaX509CertificateHolder(certificado).getSubject().getRDNs(BCStyle.SERIALNUMBER)) {
                String valor = IETFUtils.valueToString(rdn.getFirst().getValue()).replaceAll("\\D", "");
                if (valor.length() == 11) {
                    return valor;
                }
            }
        } catch (CertificateEncodingException e) {
            return null;
        }
        return null;
    }
}
