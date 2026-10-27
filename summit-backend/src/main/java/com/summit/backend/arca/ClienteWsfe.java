package com.summit.backend.arca;

import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Cliente del servicio de factura electrónica de ARCA (WSFEv1): número del último comprobante, pedido de CAE,
 * consulta de un comprobante y estado de los servidores. Los mensajes siguen el orden de elementos del WSDL (ARCA lo
 * exige).
 */
@Component
public class ClienteWsfe {

    private static final String NS = "http://ar.gov.afip.dif.FEV1/";
    private static final DateTimeFormatter FECHA = DateTimeFormatter.BASIC_ISO_DATE;
    private static final int CONCEPTO_SERVICIOS = 2;
    private static final int IVA_21 = 5;              // Id de la alícuota del 21% en ARCA
    private static final int TOKEN_INVALIDO = 600;
    private static final int SIN_DATOS = 602;

    public record Mensaje(int codigo, String texto) {
        @Override
        public String toString() {
            return codigo + ": " + texto;
        }
    }

    public record Servidores(String aplicacion, String baseDeDatos, String autenticacion) {
        public boolean ok() {
            return "OK".equals(aplicacion) && "OK".equals(baseDeDatos) && "OK".equals(autenticacion);
        }
    }

    /** La factura que anula una nota de crédito. */
    public record Asociado(int tipo, int puntoVenta, long numero, String cuit, LocalDate fecha) {
    }

    /** Un comprobante de servicios para autorizar (concepto 2, en pesos). */
    public record Solicitud(String cuit, int puntoVenta, int tipo, long numero, LocalDate fecha, int docTipo, long docNro,
                            int condicionIvaReceptor, BigDecimal total, BigDecimal neto, BigDecimal iva,
                            LocalDate servicioDesde, LocalDate servicioHasta, LocalDate vencimientoPago,
                            Asociado asociado) {
    }

    /** Respuesta al pedido de CAE. pedido y respuesta son los XML (sin el token ni la firma) para la auditoría. */
    public record Respuesta(boolean aprobado, String cae, LocalDate caeVencimiento, List<Mensaje> observaciones,
                            List<Mensaje> errores, String pedido, String respuesta) {
    }

    public record Consultado(long numero, LocalDate fecha, BigDecimal total, int docTipo, long docNro, boolean aprobado,
                             String cae, LocalDate caeVencimiento) {
    }

    public record PuntoVenta(int numero, String emisionTipo, boolean bloqueado, String baja) {
    }

    private final ConfiguracionArca config;
    private final ClienteWsaa wsaa;
    private final TransporteArca transporte;

    public ClienteWsfe(ConfiguracionArca config, ClienteWsaa wsaa, TransporteArca transporte) {
        this.config = config;
        this.wsaa = wsaa;
        this.transporte = transporte;
    }

    /** FEDummy: si los servidores de ARCA andan (no pide permiso de acceso). */
    public Servidores estadoServidores() throws IOException, ArcaException {
        Document respuesta = llamar("FEDummy", "");
        return new Servidores(Xml.texto(respuesta, "AppServer"), Xml.texto(respuesta, "DbServer"),
                Xml.texto(respuesta, "AuthServer"));
    }

    public long ultimoAutorizado(String cuit, int puntoVenta, int tipo) throws IOException, ArcaException {
        ClienteWsaa.Credenciales credenciales = wsaa.credenciales();
        Document respuesta = llamar("FECompUltimoAutorizado", auth(cuit, credenciales)
                + "<ar:PtoVta>" + puntoVenta + "</ar:PtoVta><ar:CbteTipo>" + tipo + "</ar:CbteTipo>");
        revisar(mensajes(respuesta, "Errors", "Err"));
        return largo(respuesta, "CbteNro");
    }

    public Respuesta solicitarCae(Solicitud s) throws IOException, ArcaException {
        ClienteWsaa.Credenciales credenciales = wsaa.credenciales();
        StringBuilder detalle = new StringBuilder()
                .append("<ar:Concepto>").append(CONCEPTO_SERVICIOS).append("</ar:Concepto>")
                .append("<ar:DocTipo>").append(s.docTipo()).append("</ar:DocTipo>")
                .append("<ar:DocNro>").append(s.docNro()).append("</ar:DocNro>")
                .append("<ar:CbteDesde>").append(s.numero()).append("</ar:CbteDesde>")
                .append("<ar:CbteHasta>").append(s.numero()).append("</ar:CbteHasta>")
                .append("<ar:CbteFch>").append(FECHA.format(s.fecha())).append("</ar:CbteFch>")
                .append("<ar:ImpTotal>").append(importe(s.total())).append("</ar:ImpTotal>")
                .append("<ar:ImpTotConc>0</ar:ImpTotConc>")
                .append("<ar:ImpNeto>").append(importe(s.neto())).append("</ar:ImpNeto>")
                .append("<ar:ImpOpEx>0</ar:ImpOpEx><ar:ImpTrib>0</ar:ImpTrib>")
                .append("<ar:ImpIVA>").append(importe(s.iva())).append("</ar:ImpIVA>")
                .append("<ar:FchServDesde>").append(FECHA.format(s.servicioDesde())).append("</ar:FchServDesde>")
                .append("<ar:FchServHasta>").append(FECHA.format(s.servicioHasta())).append("</ar:FchServHasta>")
                .append("<ar:FchVtoPago>").append(FECHA.format(s.vencimientoPago())).append("</ar:FchVtoPago>")
                .append("<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>")
                .append("<ar:CondicionIVAReceptorId>").append(s.condicionIvaReceptor()).append("</ar:CondicionIVAReceptorId>");
        if (s.asociado() != null) {
            Asociado a = s.asociado();
            detalle.append("<ar:CbtesAsoc><ar:CbteAsoc>")
                    .append("<ar:Tipo>").append(a.tipo()).append("</ar:Tipo>")
                    .append("<ar:PtoVta>").append(a.puntoVenta()).append("</ar:PtoVta>")
                    .append("<ar:Nro>").append(a.numero()).append("</ar:Nro>")
                    .append("<ar:Cuit>").append(Xml.esc(a.cuit())).append("</ar:Cuit>")
                    .append("<ar:CbteFch>").append(FECHA.format(a.fecha())).append("</ar:CbteFch>")
                    .append("</ar:CbteAsoc></ar:CbtesAsoc>");
        }
        if (s.iva().signum() > 0) {
            detalle.append("<ar:Iva><ar:AlicIva><ar:Id>").append(IVA_21).append("</ar:Id>")
                    .append("<ar:BaseImp>").append(importe(s.neto())).append("</ar:BaseImp>")
                    .append("<ar:Importe>").append(importe(s.iva())).append("</ar:Importe>")
                    .append("</ar:AlicIva></ar:Iva>");
        }
        String cuerpo = auth(s.cuit(), credenciales) + "<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg>"
                + "<ar:PtoVta>" + s.puntoVenta() + "</ar:PtoVta><ar:CbteTipo>" + s.tipo() + "</ar:CbteTipo></ar:FeCabReq>"
                + "<ar:FeDetReq><ar:FECAEDetRequest>" + detalle + "</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>";
        String pedido = sobre("FECAESolicitar", cuerpo);
        String texto = transporte.enviar(config.wsfeUrl(), NS + "FECAESolicitar", pedido);
        Document respuesta = Xml.leer(texto);
        revisarFalla(respuesta);

        List<Mensaje> errores = mensajes(respuesta, "Errors", "Err");
        if (errores.stream().anyMatch(e -> e.codigo() == TOKEN_INVALIDO)) {
            wsaa.descartar();
        }
        Element resultado = Xml.primero(respuesta, "FECAEDetResponse");
        List<Mensaje> observaciones = resultado == null ? List.of() : mensajes(resultado, "Observaciones", "Obs");
        boolean aprobado = resultado != null && "A".equals(Xml.texto(resultado, "Resultado"));
        String auditoria = pedido.replace(credenciales.token(), "(oculto)").replace(credenciales.firma(), "(oculto)");
        return new Respuesta(aprobado, resultado == null ? null : Xml.texto(resultado, "CAE"),
                resultado == null ? null : fecha(resultado, "CAEFchVto"), observaciones, errores, auditoria, texto);
    }

    /** El comprobante como lo tiene ARCA, o vacío si no existe (lo que pasa con uno que nunca llegó). */
    public Optional<Consultado> consultar(String cuit, int tipo, int puntoVenta, long numero) throws IOException, ArcaException {
        ClienteWsaa.Credenciales credenciales = wsaa.credenciales();
        Document respuesta = llamar("FECompConsultar", auth(cuit, credenciales)
                + "<ar:FeCompConsReq><ar:CbteTipo>" + tipo + "</ar:CbteTipo><ar:CbteNro>" + numero + "</ar:CbteNro>"
                + "<ar:PtoVta>" + puntoVenta + "</ar:PtoVta></ar:FeCompConsReq>");
        List<Mensaje> errores = mensajes(respuesta, "Errors", "Err");
        if (errores.stream().anyMatch(e -> e.codigo() == SIN_DATOS)) {
            return Optional.empty();
        }
        revisar(errores);
        Element r = Xml.primero(respuesta, "ResultGet");
        if (r == null) {
            return Optional.empty();
        }
        return Optional.of(new Consultado(largo(r, "CbteDesde"), fecha(r, "CbteFch"), monto(r, "ImpTotal"),
                (int) largo(r, "DocTipo"), largo(r, "DocNro"), "A".equals(Xml.texto(r, "Resultado")),
                Xml.texto(r, "CodAutorizacion"), fecha(r, "FchVto")));
    }

    /** Los puntos de venta de la CUIT habilitados para web services (en homologación ARCA no tiene ninguno). */
    public List<PuntoVenta> puntosDeVenta(String cuit) throws IOException, ArcaException {
        ClienteWsaa.Credenciales credenciales = wsaa.credenciales();
        Document respuesta = llamar("FEParamGetPtosVenta", auth(cuit, credenciales));
        List<Mensaje> errores = mensajes(respuesta, "Errors", "Err");
        if (errores.stream().anyMatch(e -> e.codigo() == SIN_DATOS)) {
            return List.of();
        }
        revisar(errores);
        List<PuntoVenta> puntos = new ArrayList<>();
        for (Element p : Xml.todos(respuesta, "PtoVenta")) {
            puntos.add(new PuntoVenta((int) largo(p, "Nro"), Xml.texto(p, "EmisionTipo"),
                    "S".equals(Xml.texto(p, "Bloqueado")), Xml.texto(p, "FchBaja")));
        }
        return puntos;
    }

    private Document llamar(String metodo, String cuerpo) throws IOException, ArcaException {
        Document respuesta = Xml.leer(transporte.enviar(config.wsfeUrl(), NS + metodo, sobre(metodo, cuerpo)));
        revisarFalla(respuesta);
        return respuesta;
    }

    private static String sobre(String metodo, String cuerpo) {
        return "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:ar=\"" + NS + "\">"
                + "<soap:Header/><soap:Body><ar:" + metodo + ">" + cuerpo + "</ar:" + metodo + "></soap:Body></soap:Envelope>";
    }

    private static String auth(String cuit, ClienteWsaa.Credenciales credenciales) {
        return "<ar:Auth><ar:Token>" + Xml.esc(credenciales.token()) + "</ar:Token><ar:Sign>" + Xml.esc(credenciales.firma())
                + "</ar:Sign><ar:Cuit>" + Xml.esc(cuit) + "</ar:Cuit></ar:Auth>";
    }

    // Un error SOAP es un pedido mal armado: no se arregla reintentando
    private static void revisarFalla(Document respuesta) throws ArcaException {
        Element falla = Xml.primero(respuesta, "Fault");
        if (falla != null) {
            throw new ArcaException("SOAP", "ARCA no aceptó el pedido: " + Xml.texto(falla, "faultstring"), false);
        }
    }

    private void revisar(List<Mensaje> errores) throws ArcaException {
        if (errores.isEmpty()) {
            return;
        }
        int codigo = errores.get(0).codigo();
        if (codigo == TOKEN_INVALIDO) {
            wsaa.descartar();
        }
        // 500 a 502: error interno de ARCA; 600: hay que pedir otro permiso de acceso
        boolean reintentable = codigo == TOKEN_INVALIDO || (codigo >= 500 && codigo <= 502);
        throw new ArcaException(String.valueOf(codigo), "ARCA respondió: "
                + errores.stream().map(Mensaje::toString).collect(Collectors.joining("; ")), reintentable);
    }

    private static List<Mensaje> mensajes(Node nodo, String contenedor, String elemento) {
        Element lista = Xml.primero(nodo, contenedor);
        if (lista == null) {
            return List.of();
        }
        List<Mensaje> mensajes = new ArrayList<>();
        for (Element m : Xml.todos(lista, elemento)) {
            mensajes.add(new Mensaje((int) largo(m, "Code"), Xml.texto(m, "Msg")));
        }
        return mensajes;
    }

    private static String importe(BigDecimal monto) {
        return monto.setScale(2, RoundingMode.HALF_EVEN).toPlainString();
    }

    private static long largo(Node nodo, String nombre) {
        String texto = Xml.texto(nodo, nombre);
        try {
            return texto == null ? 0 : Long.parseLong(texto);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static BigDecimal monto(Node nodo, String nombre) {
        String texto = Xml.texto(nodo, nombre);
        try {
            return texto == null ? BigDecimal.ZERO : new BigDecimal(texto);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private static LocalDate fecha(Node nodo, String nombre) {
        String texto = Xml.texto(nodo, nombre);
        try {
            return texto == null ? null : LocalDate.parse(texto, FECHA);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
