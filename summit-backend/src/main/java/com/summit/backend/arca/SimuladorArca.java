package com.summit.backend.arca;

import com.summit.backend.model.AmbienteArca;
import com.summit.backend.model.ComprobanteFiscal;
import com.summit.backend.model.EstadoComprobante;
import com.summit.backend.model.TipoComprobante;
import com.summit.backend.repository.ComprobanteFiscalRepository;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cms.CMSSignedData;
import org.bouncycastle.cms.SignerInformation;
import org.bouncycastle.cms.jcajce.JcaSimpleSignerInfoVerifierBuilder;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;

/**
 * Un ARCA de mentira dentro del backend (ambiente SIMULADOR): recibe los mismos mensajes SOAP que el real, verifica la
 * firma del pedido de acceso y valida los comprobantes con las reglas principales del manual de WSFEv1 (numeración
 * correlativa, fechas, IVA, condición frente al IVA, nota de crédito con su factura). Los CAE que da no valen nada.
 * Sirve para probar y mostrar la facturación sin certificado, y a los tests para simular cortes de conexión.
 * Lo que autorizó lo recuerda de la base (comprobantes del ambiente SIMULADOR), así no se pierde al reiniciar.
 */
@Component
public class SimuladorArca {

    /**
     * Fallas para los tests: el pedido no llega, llega pero se pierde la respuesta, ARCA da error interno, o rechaza el
     * comprobante (solo en FECAESolicitar).
     */
    public enum Falla {
        SIN_CONEXION,
        CORTE_DESPUES_DE_PROCESAR,
        ERROR_INTERNO,
        RECHAZO
    }

    private record FallaProgramada(String metodo, Falla falla) {
    }

    private record Emitido(long numero, LocalDate fecha, BigDecimal total, int docTipo, long docNro, String cae,
                           LocalDate caeVencimiento) {
    }

    private record Mensaje(int codigo, String texto) {
    }

    private static final String NS = "http://ar.gov.afip.dif.FEV1/";
    private static final DateTimeFormatter FECHA = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
    private static final BigDecimal TOLERANCIA = new BigDecimal("0.01");
    private static final BigDecimal IVA_21 = new BigDecimal("0.21");
    // Condiciones frente al IVA del receptor que admite cada letra (anexo del manual de WSFEv1)
    private static final Set<Integer> CONDICIONES_B = Set.of(4, 5, 7, 8, 9, 10, 15);
    private static final Set<Integer> CONDICIONES_C = Set.of(1, 4, 5, 6, 7, 8, 9, 10, 13, 15, 16);

    private final ComprobanteFiscalRepository comprobantes;
    private final Map<String, NavigableMap<Long, Emitido>> emitidos = new HashMap<>();
    private final Map<String, String> permisos = new HashMap<>();
    private final List<FallaProgramada> fallas = new ArrayList<>();
    private final SecureRandom azar = new SecureRandom();

    public SimuladorArca(ComprobanteFiscalRepository comprobantes) {
        this.comprobantes = comprobantes;
    }

    public synchronized String atender(String url, String soapAction, String xml) throws IOException {
        boolean acceso = url.endsWith("wsaa");
        String metodo = acceso ? "loginCms" : soapAction.substring(soapAction.lastIndexOf('/') + 1);
        Falla falla = tomarFalla(metodo);
        if (falla == Falla.SIN_CONEXION) {
            throw new IOException("Simulador de ARCA: sin conexión");
        }
        String respuesta;
        if (falla == Falla.ERROR_INTERNO) {
            respuesta = acceso ? falla("wsn.unavailable", "Servicio no disponible")
                    : respuesta(metodo, errores(new Mensaje(501, "Error interno de base de datos")));
        } else {
            Document pedido = Xml.leer(xml);
            respuesta = acceso ? acceso(pedido) : facturacion(metodo, pedido, falla == Falla.RECHAZO);
        }
        if (falla == Falla.CORTE_DESPUES_DE_PROCESAR) {
            throw new IOException("Simulador de ARCA: se cortó la conexión antes de que llegara la respuesta");
        }
        return respuesta;
    }

    /** Para los tests: la próxima llamada a ese método (loginCms, FECAESolicitar, ...) falla así. */
    public synchronized void fallar(String metodo, Falla falla) {
        fallas.add(new FallaProgramada(metodo, falla));
    }

    private Falla tomarFalla(String metodo) {
        for (int i = 0; i < fallas.size(); i++) {
            if (fallas.get(i).metodo().equals(metodo)) {
                return fallas.remove(i).falla();
            }
        }
        return null;
    }

    /** Para los tests: olvida todo (permisos, numeración y fallas programadas). */
    public synchronized void reiniciar() {
        emitidos.clear();
        permisos.clear();
        fallas.clear();
    }

    // ===== WSAA =====

    private String acceso(Document pedido) throws IOException {
        String in0 = Xml.texto(pedido, "in0");
        if (in0 == null) {
            return falla("xml.bad", "Falta el pedido de acceso (in0)");
        }
        CMSSignedData cms;
        try {
            cms = new CMSSignedData(Base64.getDecoder().decode(in0));
        } catch (IllegalArgumentException e) {
            return falla("cms.bad.base64", "No se puede decodificar el BASE64");
        } catch (Exception e) {
            return falla("cms.bad", "El CMS no es valido");
        }
        try {
            SignerInformation firmante = cms.getSignerInfos().getSigners().iterator().next();
            @SuppressWarnings("unchecked")
            Collection<X509CertificateHolder> certificados = cms.getCertificates().getMatches(firmante.getSID());
            if (certificados.isEmpty()) {
                return falla("cms.cert.notFound", "No se ha encontrado certificado de firma en el CMS");
            }
            if (!firmante.verify(new JcaSimpleSignerInfoVerifierBuilder().build(certificados.iterator().next()))) {
                return falla("cms.sign.invalid", "Firma inválida o algoritmo no soportado");
            }
        } catch (Exception e) {
            return falla("cms.sign.invalid", "Firma inválida o algoritmo no soportado");
        }
        Document tra = Xml.leer(new String((byte[]) cms.getSignedContent().getContent(), StandardCharsets.UTF_8));
        if (!"wsfe".equals(Xml.texto(tra, "service"))) {
            return falla("coe.notAuthorized", "Computador no autorizado a acceder al servicio");
        }
        OffsetDateTime ahora = OffsetDateTime.now(ClienteWsaa.ZONA);
        try {
            if (OffsetDateTime.parse(String.valueOf(Xml.texto(tra, "generationTime"))).isAfter(ahora)) {
                return falla("xml.generationTime.invalid", "generationTime posterior a la hora actual");
            }
            if (OffsetDateTime.parse(String.valueOf(Xml.texto(tra, "expirationTime"))).isBefore(ahora)) {
                return falla("xml.expirationTime.expired", "expirationTime expirado");
            }
        } catch (Exception e) {
            return falla("xml.bad", "No se entienden las fechas del pedido de acceso");
        }
        String token = azarBase64(48);
        String firma = azarBase64(24);
        permisos.put(token, firma);
        ZonedDateTime generado = ZonedDateTime.now(ClienteWsaa.ZONA);
        String ticket = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><loginTicketResponse version=\"1.0\">"
                + "<header><source>CN=wsaa simulador, O=SUMMIT, C=AR</source><destination>CN=summit</destination>"
                + "<uniqueId>" + generado.toEpochSecond() + "</uniqueId>"
                + "<generationTime>" + HORA.format(generado) + "</generationTime>"
                + "<expirationTime>" + HORA.format(generado.plusHours(12)) + "</expirationTime></header>"
                + "<credentials><token>" + token + "</token><sign>" + firma + "</sign></credentials></loginTicketResponse>";
        return "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\"><soapenv:Body>"
                + "<loginCmsResponse xmlns=\"http://wsaa.view.sua.dvadac.desein.afip.gov\"><loginCmsReturn>"
                + Xml.esc(ticket) + "</loginCmsReturn></loginCmsResponse></soapenv:Body></soapenv:Envelope>";
    }

    private static String falla(String codigo, String mensaje) {
        return "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\"><soapenv:Body><soapenv:Fault>"
                + "<faultcode xmlns:ns1=\"http://xml.apache.org/axis/\">ns1:" + codigo + "</faultcode>"
                + "<faultstring>" + Xml.esc(mensaje) + "</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>";
    }

    // ===== WSFEv1 =====

    private String facturacion(String metodo, Document pedido, boolean rechazar) {
        if (metodo.equals("FEDummy")) {
            return respuesta(metodo, "<AppServer>OK</AppServer><DbServer>OK</DbServer><AuthServer>OK</AuthServer>");
        }
        String token = Xml.texto(pedido, "Token");
        if (token == null || !Objects.equals(permisos.get(token), Xml.texto(pedido, "Sign"))) {
            return respuesta(metodo, errores(new Mensaje(600, "ValidacionDeToken: No validaron las credenciales")));
        }
        String cuit = String.valueOf(Xml.texto(pedido, "Cuit"));
        return switch (metodo) {
            case "FECompUltimoAutorizado" -> {
                int puntoVenta = entero(pedido, "PtoVta");
                int tipo = entero(pedido, "CbteTipo");
                NavigableMap<Long, Emitido> serie = numeracion(cuit, puntoVenta, tipo);
                yield respuesta(metodo, "<PtoVta>" + puntoVenta + "</PtoVta><CbteTipo>" + tipo + "</CbteTipo><CbteNro>"
                        + (serie.isEmpty() ? 0 : serie.lastKey()) + "</CbteNro>");
            }
            case "FECompConsultar" -> consultar(pedido, cuit);
            case "FEParamGetPtosVenta" ->
                    respuesta(metodo, errores(new Mensaje(602, "Sin Resultados: - en el metodo consultar puntos de venta")));
            case "FECAESolicitar" -> solicitar(pedido, cuit, rechazar);
            default -> respuesta(metodo, errores(new Mensaje(500, "El simulador no conoce el método " + metodo)));
        };
    }

    private String consultar(Document pedido, String cuit) {
        int tipo = entero(pedido, "CbteTipo");
        int puntoVenta = entero(pedido, "PtoVta");
        Emitido e = numeracion(cuit, puntoVenta, tipo).get(largo(pedido, "CbteNro"));
        if (e == null) {
            return respuesta("FECompConsultar", errores(new Mensaje(602,
                    "No existen datos en nuestros registros para los parametros ingresados.")));
        }
        return respuesta("FECompConsultar", "<ResultGet><Concepto>2</Concepto><DocTipo>" + e.docTipo() + "</DocTipo>"
                + "<DocNro>" + e.docNro() + "</DocNro><CbteDesde>" + e.numero() + "</CbteDesde><CbteHasta>" + e.numero()
                + "</CbteHasta><CbteFch>" + FECHA.format(e.fecha()) + "</CbteFch><ImpTotal>" + e.total().toPlainString()
                + "</ImpTotal><Resultado>A</Resultado><CodAutorizacion>" + e.cae() + "</CodAutorizacion>"
                + "<EmisionTipo>CAE</EmisionTipo><FchVto>" + FECHA.format(e.caeVencimiento()) + "</FchVto>"
                + "<PtoVta>" + puntoVenta + "</PtoVta><CbteTipo>" + tipo + "</CbteTipo></ResultGet>");
    }

    private String solicitar(Document pedido, String cuit, boolean rechazar) {
        Element cabecera = Xml.primero(pedido, "FeCabReq");
        Element detalle = Xml.primero(pedido, "FECAEDetRequest");
        if (cabecera == null || detalle == null || entero(cabecera, "CantReg") != 1) {
            return respuesta("FECAESolicitar", errores(new Mensaje(10001, "El simulador autoriza un comprobante por pedido")));
        }
        int puntoVenta = entero(cabecera, "PtoVta");
        int tipo = entero(cabecera, "CbteTipo");
        List<Mensaje> rechazos = new ArrayList<>();
        List<Mensaje> avisos = new ArrayList<>();
        if (rechazar) {
            rechazos.add(new Mensaje(10000, "Rechazo de prueba del simulador"));
        }

        NavigableMap<Long, Emitido> serie = numeracion(cuit, puntoVenta, tipo);
        long numero = largo(detalle, "CbteDesde");
        LocalDate fecha = fecha(detalle, "CbteFch");
        LocalDate hoy = LocalDate.now(ClienteWsaa.ZONA);
        if (numero != largo(detalle, "CbteHasta")) {
            rechazos.add(new Mensaje(10011, "En las facturas B y C se autoriza un comprobante por vez"));
        }
        long siguiente = serie.isEmpty() ? 1 : serie.lastKey() + 1;
        if (numero != siguiente || (fecha != null && !serie.isEmpty() && fecha.isBefore(serie.lastEntry().getValue().fecha()))) {
            rechazos.add(new Mensaje(10016, "El numero o fecha del comprobante no se corresponde con el proximo a autorizar. "
                    + "Consultar metodo FECompUltimoAutorizado."));
        }
        if (fecha == null || fecha.isBefore(hoy.minusDays(10)) || fecha.isAfter(hoy.plusDays(10))) {
            rechazos.add(new Mensaje(10017, "La fecha del comprobante de servicios puede ser de hasta 10 días antes o "
                    + "después de la fecha de envío"));
        }
        if (entero(detalle, "Concepto") != 1) {
            LocalDate desde = fecha(detalle, "FchServDesde");
            LocalDate hasta = fecha(detalle, "FchServHasta");
            LocalDate vencimiento = fecha(detalle, "FchVtoPago");
            if (desde == null || hasta == null || vencimiento == null) {
                rechazos.add(new Mensaje(10031, "Para servicios son obligatorias FchServDesde, FchServHasta y FchVtoPago"));
            } else {
                if (desde.isAfter(hasta)) {
                    rechazos.add(new Mensaje(10032, "FchServDesde no puede ser posterior a FchServHasta"));
                }
                if (fecha != null && vencimiento.isBefore(fecha)) {
                    rechazos.add(new Mensaje(10036, "FchVtoPago no puede ser anterior a la fecha del comprobante"));
                }
            }
        }

        int docTipo = entero(detalle, "DocTipo");
        long docNro = largo(detalle, "DocNro");
        if (docTipo == 99 && docNro != 0) {
            rechazos.add(new Mensaje(10015, "Si el receptor no se identifica (DocTipo 99), DocNro debe ser 0"));
        } else if (docTipo == 96 && (docNro < 1_000_000 || docNro > 99_999_999)) {
            rechazos.add(new Mensaje(10015, "El DNI del receptor no es válido"));
        } else if (docTipo != 99 && docTipo != 96 && docTipo != 80) {
            rechazos.add(new Mensaje(10015, "Tipo de documento del receptor no admitido"));
        }

        String letra = switch (tipo) {
            case 6, 8 -> "B";
            case 11, 13 -> "C";
            default -> null;
        };
        if (letra == null) {
            rechazos.add(new Mensaje(10007, "Tipo de comprobante no admitido por el simulador (6, 8, 11 o 13)"));
        }
        String condicion = Xml.texto(detalle, "CondicionIVAReceptorId");
        if (condicion == null) {
            rechazos.add(new Mensaje(10246, "El campo Condicion Frente al IVA del receptor es obligatorio"));
        } else if (letra != null && !("B".equals(letra) ? CONDICIONES_B : CONDICIONES_C).contains(entero(detalle, "CondicionIVAReceptorId"))) {
            rechazos.add(new Mensaje(10243, "La condicion frente al IVA del receptor no es valida para comprobantes clase " + letra));
        }

        BigDecimal total = monto(detalle, "ImpTotal");
        BigDecimal neto = monto(detalle, "ImpNeto");
        BigDecimal iva = monto(detalle, "ImpIVA");
        BigDecimal partes = neto.add(iva).add(monto(detalle, "ImpTotConc")).add(monto(detalle, "ImpOpEx"))
                .add(monto(detalle, "ImpTrib"));
        if (total.subtract(partes).abs().compareTo(TOLERANCIA) > 0) {
            rechazos.add(new Mensaje(10048, "El importe total no es igual a la suma de sus partes"));
        }
        List<Element> alicuotas = Xml.todos(detalle, "AlicIva");
        if ("C".equals(letra) && (iva.signum() != 0 || !alicuotas.isEmpty())) {
            rechazos.add(new Mensaje(10071, "Los comprobantes clase C no deben informar IVA"));
        } else if ("B".equals(letra)) {
            BigDecimal bases = BigDecimal.ZERO;
            BigDecimal importes = BigDecimal.ZERO;
            for (Element alicuota : alicuotas) {
                BigDecimal base = monto(alicuota, "BaseImp");
                BigDecimal importe = monto(alicuota, "Importe");
                bases = bases.add(base);
                importes = importes.add(importe);
                if (entero(alicuota, "Id") == 5 && importe.subtract(base.multiply(IVA_21)).abs().compareTo(TOLERANCIA) > 0) {
                    rechazos.add(new Mensaje(10051, "El importe del IVA no corresponde a la alícuota del 21%"));
                }
            }
            if (alicuotas.isEmpty() && neto.signum() > 0) {
                rechazos.add(new Mensaje(10070, "Con un neto gravado mayor a cero hay que informar el IVA"));
            }
            if (bases.subtract(neto).abs().compareTo(TOLERANCIA) > 0 || importes.subtract(iva).abs().compareTo(TOLERANCIA) > 0) {
                rechazos.add(new Mensaje(10061, "Las bases imponibles y el IVA no suman ImpNeto e ImpIVA"));
            }
        }

        if (tipo == 8 || tipo == 13) {
            Element asociado = Xml.primero(detalle, "CbteAsoc");
            if (asociado == null) {
                rechazos.add(new Mensaje(10197, "Las notas de crédito deben informar el comprobante asociado"));
            } else {
                int tipoAsociado = entero(asociado, "Tipo");
                Emitido factura = tipoAsociado == (tipo == 8 ? 6 : 11)
                        ? numeracion(cuit, entero(asociado, "PtoVta"), tipoAsociado).get(largo(asociado, "Nro")) : null;
                if (factura == null) {
                    rechazos.add(new Mensaje(10197, "El comprobante asociado no existe o no es de la misma clase"));
                } else if (total.compareTo(factura.total()) > 0) {
                    avisos.add(new Mensaje(10237, "El importe de la nota de crédito supera el del comprobante asociado"));
                }
            }
        }

        boolean aprobado = rechazos.isEmpty();
        String cae = "";
        LocalDate caeVencimiento = null;
        if (aprobado) {
            cae = (1 + azar.nextInt(9)) + String.format("%013d", Math.floorMod(azar.nextLong(), 10_000_000_000_000L));
            caeVencimiento = fecha.plusDays(10);
            serie.put(numero, new Emitido(numero, fecha, total, docTipo, docNro, cae, caeVencimiento));
        }
        List<Mensaje> observaciones = new ArrayList<>(rechazos);
        observaciones.addAll(avisos);
        StringBuilder obs = new StringBuilder();
        if (!observaciones.isEmpty()) {
            obs.append("<Observaciones>");
            observaciones.forEach(m -> obs.append("<Obs><Code>").append(m.codigo()).append("</Code><Msg>")
                    .append(Xml.esc(m.texto())).append("</Msg></Obs>"));
            obs.append("</Observaciones>");
        }
        String resultado = aprobado ? "A" : "R";
        return respuesta("FECAESolicitar", "<FeCabResp><Cuit>" + Xml.esc(cuit) + "</Cuit><PtoVta>" + puntoVenta
                + "</PtoVta><CbteTipo>" + tipo + "</CbteTipo><FchProceso>"
                + ZonedDateTime.now(ClienteWsaa.ZONA).format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + "</FchProceso><CantReg>1</CantReg><Resultado>" + resultado + "</Resultado><Reproceso>N</Reproceso></FeCabResp>"
                + "<FeDetResp><FECAEDetResponse><Concepto>" + entero(detalle, "Concepto") + "</Concepto><DocTipo>" + docTipo
                + "</DocTipo><DocNro>" + docNro + "</DocNro><CbteDesde>" + numero + "</CbteDesde><CbteHasta>" + numero
                + "</CbteHasta><CbteFch>" + (fecha == null ? "" : FECHA.format(fecha)) + "</CbteFch><Resultado>" + resultado
                + "</Resultado>" + obs + "<CAE>" + cae + "</CAE><CAEFchVto>"
                + (caeVencimiento == null ? "" : FECHA.format(caeVencimiento)) + "</CAEFchVto></FECAEDetResponse></FeDetResp>");
    }

    // Lo autorizado en esa numeración; la primera vez se carga de la base
    private NavigableMap<Long, Emitido> numeracion(String cuit, int puntoVenta, int tipo) {
        return emitidos.computeIfAbsent(cuit + "|" + puntoVenta + "|" + tipo, clave -> {
            NavigableMap<Long, Emitido> serie = new TreeMap<>();
            TipoComprobante tipoComprobante;
            try {
                tipoComprobante = TipoComprobante.deCodigo(tipo);
            } catch (IllegalArgumentException e) {
                return serie;
            }
            for (ComprobanteFiscal c : comprobantes.findByAmbienteAndCuitEmisorAndTipoAndPuntoVentaAndEstado(
                    AmbienteArca.SIMULADOR, cuit, tipoComprobante, puntoVenta, EstadoComprobante.AUTORIZADO)) {
                serie.put(c.getNumero(), new Emitido(c.getNumero(), c.getFecha(), c.getImpTotal(), c.getDocTipo(),
                        c.getDocNro(), c.getCae(), c.getCaeVencimiento()));
            }
            return serie;
        });
    }

    private static String respuesta(String metodo, String contenido) {
        return "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body><" + metodo
                + "Response xmlns=\"" + NS + "\"><" + metodo + "Result>" + contenido + "</" + metodo + "Result></" + metodo
                + "Response></soap:Body></soap:Envelope>";
    }

    private static String errores(Mensaje mensaje) {
        return "<Errors><Err><Code>" + mensaje.codigo() + "</Code><Msg>" + Xml.esc(mensaje.texto()) + "</Msg></Err></Errors>";
    }

    private String azarBase64(int bytes) {
        byte[] b = new byte[bytes];
        azar.nextBytes(b);
        return Base64.getEncoder().encodeToString(b);
    }

    private static int entero(Node nodo, String nombre) {
        return (int) largo(nodo, nombre);
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
        } catch (Exception e) {
            return null;
        }
    }
}
