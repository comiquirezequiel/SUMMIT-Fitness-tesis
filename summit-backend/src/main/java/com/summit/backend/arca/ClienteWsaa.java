package com.summit.backend.arca;

import com.summit.backend.model.TicketAccesoArca;
import com.summit.backend.repository.TicketAccesoArcaRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * Permiso de acceso a la facturación (WSAA): se arma el pedido (TRA), se firma con el certificado y ARCA devuelve un
 * token y una firma que valen 12 horas. Se reutiliza mientras está vigente, porque ARCA no da otro antes.
 */
@Component
@Slf4j
public class ClienteWsaa {

    static final ZoneId ZONA = ZoneId.of("America/Argentina/Buenos_Aires");
    private static final DateTimeFormatter HORA_TRA = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX");
    // Se pide uno nuevo un rato antes de que venza, para no usarlo justo cuando caduca
    private static final int MARGEN_MINUTOS = 10;

    /** Lo que va en el Auth de cada pedido a la facturación. */
    public record Credenciales(String token, String firma) {
    }

    private final ConfiguracionArca config;
    private final CertificadosArca certificados;
    private final TransporteArca transporte;
    private final TicketAccesoArcaRepository tickets;

    public ClienteWsaa(ConfiguracionArca config, CertificadosArca certificados, TransporteArca transporte,
                       TicketAccesoArcaRepository tickets) {
        this.config = config;
        this.certificados = certificados;
        this.transporte = transporte;
        this.tickets = tickets;
    }

    public synchronized Credenciales credenciales() throws IOException, ArcaException {
        CertificadosArca.CertificadoArca certificado = certificados.actual();
        LocalDateTime ahora = LocalDateTime.now(ZONA);
        TicketAccesoArca guardado = tickets.findByAmbienteAndHuellaCertificado(config.ambiente(), certificado.huella())
                .orElse(null);
        if (guardado != null && guardado.getVence().isAfter(ahora.plusMinutes(MARGEN_MINUTOS))) {
            return new Credenciales(guardado.getToken(), guardado.getFirma());
        }

        String cms = FirmaCms.firmar(tra().getBytes(StandardCharsets.UTF_8), certificado);
        String pedido = "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\""
                + " xmlns:wsaa=\"http://wsaa.view.sua.dvadac.desein.afip.gov\"><soapenv:Header/><soapenv:Body>"
                + "<wsaa:loginCms><wsaa:in0>" + cms + "</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>";
        Document respuesta = Xml.leer(transporte.enviar(config.wsaaUrl(), "", pedido));
        Element falla = Xml.primero(respuesta, "Fault");
        if (falla != null) {
            String codigo = String.valueOf(Xml.texto(falla, "faultcode"));
            codigo = codigo.substring(codigo.indexOf(':') + 1);
            throw new ArcaException(codigo, mensaje(codigo, Xml.texto(falla, "faultstring")),
                    codigo.startsWith("wsaa.") || codigo.equals("wsn.unavailable"));
        }
        String ticketXml = Xml.texto(respuesta, "loginCmsReturn");
        if (ticketXml == null) {
            throw new IOException("ARCA no devolvió el permiso de acceso");
        }
        Document ticket = Xml.leer(ticketXml);
        String token = Xml.texto(ticket, "token");
        String firma = Xml.texto(ticket, "sign");
        String vence = Xml.texto(ticket, "expirationTime");
        if (token == null || firma == null || vence == null) {
            throw new IOException("El permiso de acceso de ARCA llegó incompleto");
        }
        TicketAccesoArca nuevo = guardado != null ? guardado : TicketAccesoArca.builder()
                .ambiente(config.ambiente()).huellaCertificado(certificado.huella()).build();
        nuevo.setToken(token);
        nuevo.setFirma(firma);
        nuevo.setVence(horaArgentina(vence));
        tickets.save(nuevo);
        log.info("ARCA ({}) dio un permiso de acceso nuevo, vence {}", config.ambiente(), nuevo.getVence());
        return new Credenciales(token, firma);
    }

    /** ARCA dijo que el permiso no vale (por ejemplo, se reinició el simulador): se descarta para pedir otro. */
    public synchronized void descartar() {
        try {
            CertificadosArca.CertificadoArca certificado = certificados.actual();
            tickets.findByAmbienteAndHuellaCertificado(config.ambiente(), certificado.huella()).ifPresent(tickets::delete);
        } catch (ArcaException e) {
            // Sin certificado no hay permiso que descartar
        }
    }

    // Pedido de acceso: vale de 10 minutos antes a 10 minutos después de ahora (tolera un reloj algo corrido)
    private static String tra() {
        ZonedDateTime ahora = ZonedDateTime.now(ZONA);
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><loginTicketRequest version=\"1.0\"><header>"
                + "<uniqueId>" + ahora.toEpochSecond() + "</uniqueId>"
                + "<generationTime>" + HORA_TRA.format(ahora.minusMinutes(10)) + "</generationTime>"
                + "<expirationTime>" + HORA_TRA.format(ahora.plusMinutes(10)) + "</expirationTime>"
                + "</header><service>wsfe</service></loginTicketRequest>";
    }

    private static LocalDateTime horaArgentina(String texto) throws IOException {
        try {
            return OffsetDateTime.parse(texto).atZoneSameInstant(ZONA).toLocalDateTime();
        } catch (DateTimeParseException e) {
            throw new IOException("ARCA devolvió una fecha de vencimiento que no se entiende: " + texto, e);
        }
    }

    // Los errores más comunes, explicados (especificación técnica del WSAA)
    private static String mensaje(String codigo, String detalle) {
        return switch (codigo) {
            case "coe.alreadyAuthenticated" -> "ARCA ya entregó un permiso de acceso para este certificado y no quedó "
                    + "guardado: hay que esperar a que venza (hasta 12 horas)";
            case "coe.notAuthorized" -> "El certificado no está autorizado a facturar: falta asociarlo al servicio "
                    + "\"Facturación Electrónica\" en el Administrador de Relaciones de ARCA";
            case "cms.cert.untrusted", "cms.cert.invalid" -> "ARCA no reconoce el certificado. Revisá que sea de este "
                    + "ambiente (el de homologación no sirve en producción, ni al revés)";
            case "cms.cert.expired" -> "El certificado de ARCA venció: hay que pedir uno nuevo";
            case "xml.generationTime.invalid", "xml.expirationTime.expired", "xml.expirationTime.invalid" ->
                    "La hora de esta PC no coincide con la de ARCA: revisá la fecha, la hora y la zona horaria de Windows";
            default -> "ARCA rechazó el pedido de acceso (" + codigo + ")" + (detalle == null ? "" : ": " + detalle);
        };
    }
}
