package com.summit.backend.service;

import com.summit.backend.PruebaIntegracion;
import com.summit.backend.arca.SimuladorArca;
import com.summit.backend.dto.CobroRequestDTO;
import com.summit.backend.dto.ComprobanteFiscalDTO;
import com.summit.backend.dto.DatosFiscalesDTO;
import com.summit.backend.dto.EstadoFacturacionDTO;
import com.summit.backend.dto.PagoListadoDTO;
import com.summit.backend.dto.PruebaConexionDTO;
import com.summit.backend.model.CondicionIva;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.TicketAccesoArcaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Factura electrónica (FacturacionService) contra el simulador de ARCA, que recibe los mismos mensajes SOAP que el
 * real y valida numeración, fechas e IVA: cada cobro aprobado sale con su factura, los cortes de conexión no duplican
 * ni saltean números, un rechazo no gasta el número y una factura se anula con una nota de crédito.
 */
class FacturacionTest extends PruebaIntegracion {

    private static final String CUIT = "20123456786";
    private static final int PUNTO_VENTA = 3;

    @Autowired FacturacionService facturacion;
    @Autowired DatosFiscalesService datosFiscales;
    @Autowired PagoService pagos;
    @Autowired SimuladorArca simulador;
    @Autowired TicketAccesoArcaRepository tickets;

    @BeforeEach
    void simuladorDeCero() {
        simulador.reiniciar();
    }

    private static DatosFiscalesDTO datos(String cuit, CondicionIva condicion, boolean identificarSocio) {
        return new DatosFiscalesDTO(cuit, "Gimnasio de Prueba SRL", condicion.name(), "Exento", LocalDate.of(2020, 3, 1),
                "Av. Siempre Viva 123, Córdoba", PUNTO_VENTA, identificarSocio);
    }

    private void datosFiscales(CondicionIva condicion, boolean identificarSocio) {
        datosFiscales.guardar(datos(CUIT, condicion, identificarSocio));
    }

    private PagoListadoDTO cobrar(Usuario socio, int precio) {
        return pagos.registrarPago(cobro(socio, plan(precio, null), precio), null);
    }

    /** Procesa la cola y devuelve el comprobante como quedó. */
    private ComprobanteFiscalDTO procesar(Long idComprobante) {
        facturacion.procesarPendientes();
        return facturacion.detalle(idComprobante);
    }

    private ComprobanteFiscalDTO facturarYProcesar(PagoListadoDTO pago) {
        return procesar(pago.factura().idComprobante());
    }

    @Test
    void unCobroSaleConFacturaCYElQrDeArca() {
        datosFiscales(CondicionIva.MONOTRIBUTO, false);
        PagoListadoDTO pago = cobrar(socio(), 45000);
        assertThat(pago.factura().estado()).isEqualTo("PENDIENTE");
        // No se factura dos veces el mismo cobro
        assertThatThrownBy(() -> facturacion.facturar(pago.idPago(), false, null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("pendiente");

        ComprobanteFiscalDTO factura = facturarYProcesar(pago);
        assertThat(factura.estado()).isEqualTo("AUTORIZADO");
        assertThat(factura.tipo()).isEqualTo("FACTURA_C");
        assertThat(factura.numeroCompleto()).isEqualTo("00003-00000001");
        assertThat(factura.cae()).matches("\\d{14}");
        assertThat(factura.caeVencimiento()).isEqualTo(factura.fecha().plusDays(10));
        assertThat(factura.neto()).isEqualByComparingTo("45000");
        assertThat(factura.iva()).isEqualByComparingTo("0");
        assertThat(factura.docTipo()).isEqualTo(99);
        assertThat(factura.docNro()).isZero();
        assertThat(factura.emisorCondicionIva()).isEqualTo("Responsable Monotributo");
        // El período facturado es la membresía que se pagó
        assertThat(factura.servicioHasta()).isEqualTo(pago.venceMembresia());
        assertThat(factura.servicioDesde()).isEqualTo(pago.venceMembresia().minusDays(30));
        assertThat(factura.deVerdad()).isFalse();

        assertThat(factura.qrUrl()).startsWith("https://www.arca.gob.ar/fe/qr/?p=");
        String qr = new String(Base64.getDecoder().decode(factura.qrUrl().substring(factura.qrUrl().indexOf("?p=") + 3)),
                StandardCharsets.UTF_8);
        assertThat(qr).contains("\"cuit\":" + CUIT, "\"ptoVta\":3", "\"tipoCmp\":11", "\"nroCmp\":1",
                "\"importe\":45000.00", "\"tipoDocRec\":99", "\"codAut\":" + factura.cae());

        assertThat(facturarYProcesar(cobrar(socio(), 20000)).numero()).isEqualTo(2);
    }

    @Test
    void conResponsableInscriptoSaleFacturaBConElIvaContenido() {
        datosFiscales(CondicionIva.RESPONSABLE_INSCRIPTO, false);
        ComprobanteFiscalDTO factura = facturarYProcesar(cobrar(socio(), 45000));
        assertThat(factura.estado()).isEqualTo("AUTORIZADO");
        assertThat(factura.tipo()).isEqualTo("FACTURA_B");
        assertThat(factura.numero()).isEqualTo(1);
        assertThat(factura.neto()).isEqualByComparingTo("37190.08");
        assertThat(factura.iva()).isEqualByComparingTo("7809.92");
        assertThat(factura.emisorCondicionIva()).isEqualTo("IVA Responsable Inscripto");

        // El simulador valida que el IVA sea el 21% del neto: con cualquier total tiene que cerrar
        for (int total : new int[]{1, 99, 1001, 33333, 123457}) {
            ComprobanteFiscalDTO otra = facturarYProcesar(cobrar(socio(), total));
            assertThat(otra.estado()).as("total %d", total).isEqualTo("AUTORIZADO");
            assertThat(otra.neto().add(otra.iva())).isEqualByComparingTo(BigDecimal.valueOf(total));
        }
    }

    @Test
    void unCobroAVerificarSeFacturaRecienCuandoSeAprueba() {
        datosFiscales(CondicionIva.MONOTRIBUTO, false);
        CobroRequestDTO pedido = cobro(socio(), plan(10000, null), 10000).toBuilder().metodoPago("TRANSFERENCIA").aVerificar(true).build();
        PagoListadoDTO pago = pagos.registrarPago(pedido, null);
        assertThat(pago.factura()).isNull();
        assertThat(facturarYProcesar(pagos.verificarPago(pago.idPago(), true, null)).estado()).isEqualTo("AUTORIZADO");

        CobroRequestDTO otro = cobro(socio(), plan(10000, null), 10000).toBuilder().metodoPago("TRANSFERENCIA").aVerificar(true).build();
        PagoListadoDTO rechazado = pagos.verificarPago(pagos.registrarPago(otro, null).idPago(), false, null);
        assertThat(rechazado.factura()).isNull();
        assertThat(facturacion.dePago(rechazado.idPago())).isEmpty();
    }

    @Test
    void unCobroSinMontoNoSeFactura() {
        datosFiscales(CondicionIva.MONOTRIBUTO, false);
        PagoListadoDTO pago = cobrar(socio(), 0);
        assertThat(pago.factura()).isNull();
        assertThatThrownBy(() -> facturacion.facturar(pago.idPago(), false, null)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void sinDatosFiscalesLaFacturaEsperaYSaleAlCompletarlos() {
        PagoListadoDTO pago = cobrar(socio(), 10000);
        ComprobanteFiscalDTO esperando = facturarYProcesar(pago);
        assertThat(esperando.estado()).isEqualTo("PENDIENTE");
        assertThat(esperando.ultimoError()).contains("Faltan datos fiscales", "CUIT");
        assertThat(esperando.proximoIntento()).isAfter(LocalDateTime.now());
        assertThat(facturacion.estado().pendientes()).isEqualTo(1);

        datosFiscales(CondicionIva.MONOTRIBUTO, false);
        facturacion.procesarAhora();
        assertThat(facturarYProcesar(pago).estado()).isEqualTo("AUTORIZADO");
    }

    @Test
    void siSePierdeLaRespuestaSeLePreguntaAArcaYNoSeDuplicaElNumero() {
        datosFiscales(CondicionIva.MONOTRIBUTO, false);
        PagoListadoDTO pago = cobrar(socio(), 10000);
        simulador.fallar("FECAESolicitar", SimuladorArca.Falla.CORTE_DESPUES_DE_PROCESAR);
        ComprobanteFiscalDTO enElAire = facturarYProcesar(pago);
        assertThat(enElAire.estado()).isEqualTo("INCIERTO");
        assertThat(enElAire.numero()).isEqualTo(1);

        // Mientras no se sepa qué pasó, no se usa otro número
        PagoListadoDTO otro = cobrar(socio(), 20000);
        assertThat(facturarYProcesar(otro).estado()).isEqualTo("PENDIENTE");

        facturacion.procesarAhora();
        facturacion.procesarPendientes();
        ComprobanteFiscalDTO recuperada = facturacion.detalle(enElAire.idComprobante());
        assertThat(recuperada.estado()).isEqualTo("AUTORIZADO");
        assertThat(recuperada.numero()).isEqualTo(1);
        assertThat(recuperada.cae()).matches("\\d{14}");
        assertThat(facturacion.detalle(otro.factura().idComprobante()).numero()).isEqualTo(2);
    }

    @Test
    void siElPedidoNoLlegoVuelveASalirConElMismoNumero() {
        datosFiscales(CondicionIva.MONOTRIBUTO, false);
        PagoListadoDTO pago = cobrar(socio(), 10000);
        simulador.fallar("FECAESolicitar", SimuladorArca.Falla.SIN_CONEXION);
        assertThat(facturarYProcesar(pago).estado()).isEqualTo("INCIERTO");

        facturacion.procesarAhora();
        ComprobanteFiscalDTO factura = facturarYProcesar(pago);
        assertThat(factura.estado()).isEqualTo("AUTORIZADO");
        assertThat(factura.numero()).isEqualTo(1);
    }

    @Test
    void conArcaCaidoLaFacturaEsperaSinGastarNumero() {
        datosFiscales(CondicionIva.MONOTRIBUTO, false);
        PagoListadoDTO pago = cobrar(socio(), 10000);
        simulador.fallar("FECompUltimoAutorizado", SimuladorArca.Falla.SIN_CONEXION);
        ComprobanteFiscalDTO esperando = facturarYProcesar(pago);
        assertThat(esperando.estado()).isEqualTo("PENDIENTE");
        assertThat(esperando.numero()).isNull();
        assertThat(esperando.ultimoError()).contains("ARCA no responde");
        assertThat(esperando.proximoIntento()).isAfter(LocalDateTime.now());

        // Un error interno de ARCA tampoco es un rechazo
        facturacion.procesarAhora();
        simulador.fallar("FECAESolicitar", SimuladorArca.Falla.ERROR_INTERNO);
        ComprobanteFiscalDTO otraVez = facturarYProcesar(pago);
        assertThat(otraVez.estado()).isEqualTo("PENDIENTE");
        assertThat(otraVez.numero()).isNull();
        assertThat(otraVez.ultimoError()).contains("501");

        facturacion.procesarAhora();
        ComprobanteFiscalDTO factura = facturarYProcesar(pago);
        assertThat(factura.estado()).isEqualTo("AUTORIZADO");
        assertThat(factura.numero()).isEqualTo(1);
    }

    @Test
    void unRechazoNoGastaElNumeroYSePuedeReintentar() {
        datosFiscales(CondicionIva.MONOTRIBUTO, false);
        PagoListadoDTO primero = cobrar(socio(), 10000);
        simulador.fallar("FECAESolicitar", SimuladorArca.Falla.RECHAZO);
        ComprobanteFiscalDTO rechazada = facturarYProcesar(primero);
        assertThat(rechazada.estado()).isEqualTo("RECHAZADO");
        assertThat(rechazada.numero()).isNull();
        assertThat(rechazada.observaciones()).contains("10000");
        assertThat(rechazada.ultimoError()).contains("Rechazo de prueba");
        assertThat(facturacion.estado().rechazados()).isEqualTo(1);

        assertThat(facturarYProcesar(cobrar(socio(), 20000)).numero()).isEqualTo(1);

        facturacion.reintentar(rechazada.idComprobante());
        ComprobanteFiscalDTO reintentada = procesar(rechazada.idComprobante());
        assertThat(reintentada.estado()).isEqualTo("AUTORIZADO");
        assertThat(reintentada.numero()).isEqualTo(2);
        assertThatThrownBy(() -> facturacion.reintentar(rechazada.idComprobante())).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void unaFacturaSeAnulaConUnaNotaDeCreditoDeLaMismaLetra() {
        datosFiscales(CondicionIva.MONOTRIBUTO, false);
        Usuario socio = socio();
        ComprobanteFiscalDTO factura = facturarYProcesar(cobrar(socio, 10000));
        Usuario admin = usuario(Rol.ADMIN);

        assertThatThrownBy(() -> facturacion.anular(factura.idComprobante(), " ", admin.getEmail()))
                .isInstanceOf(IllegalArgumentException.class);
        ComprobanteFiscalDTO pedida = facturacion.anular(factura.idComprobante(), "Se cobró dos veces", admin.getEmail());
        assertThat(pedida.notaCredito()).isTrue();
        assertThat(pedida.estado()).isEqualTo("PENDIENTE");

        ComprobanteFiscalDTO nota = procesar(pedida.idComprobante());
        assertThat(nota.estado()).isEqualTo("AUTORIZADO");
        assertThat(nota.tipo()).isEqualTo("NOTA_CREDITO_C");
        assertThat(nota.numero()).isEqualTo(1);
        assertThat(nota.total()).isEqualByComparingTo("10000");
        assertThat(nota.idAsociado()).isEqualTo(factura.idComprobante());
        assertThat(nota.asociado()).isEqualTo("factura C 00003-00000001");
        assertThat(nota.motivo()).isEqualTo("Se cobró dos veces");
        assertThat(nota.solicitadoPor()).isEqualTo(admin.getNombreCompleto());

        assertThat(facturacion.detalle(factura.idComprobante()).anulada()).isTrue();
        assertThat(pagos.historialPorSocio(socio.getIdUsuario()).get(0).factura().anulada()).isTrue();
        assertThatThrownBy(() -> facturacion.anular(factura.idComprobante(), "Otra vez", null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("nota de crédito C 00003-00000001");
        assertThatThrownBy(() -> facturacion.anular(nota.idComprobante(), "No se puede", null))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void unCobroConLaFacturaAnuladaSeVuelveAFacturarConElDni() {
        datosFiscales(CondicionIva.MONOTRIBUTO, false);
        Usuario socio = socio();
        PagoListadoDTO pago = cobrar(socio, 10000);
        ComprobanteFiscalDTO factura = facturarYProcesar(pago);
        assertThatThrownBy(() -> facturacion.facturar(pago.idPago(), true, null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("00003-00000001");

        procesar(facturacion.anular(factura.idComprobante(), "La quería con su DNI", null).idComprobante());
        ComprobanteFiscalDTO nueva = procesar(facturacion.facturar(pago.idPago(), true, null).idComprobante());
        assertThat(nueva.estado()).isEqualTo("AUTORIZADO");
        assertThat(nueva.numero()).isEqualTo(2);
        assertThat(nueva.docTipo()).isEqualTo(96);
        assertThat(nueva.docNro()).isEqualTo(Long.parseLong(socio.getDni()));
        assertThat(nueva.receptorNombre()).isEqualTo(socio.getNombreCompleto());
        assertThat(pagos.historialPorSocio(socio.getIdUsuario()).get(0).factura().numero()).isEqualTo("00003-00000002");
    }

    @Test
    void conIdentificarSocioLaFacturaSaleConSuDniSiEsValido() {
        datosFiscales(CondicionIva.MONOTRIBUTO, true);
        Usuario socio = socio();
        ComprobanteFiscalDTO conDni = facturarYProcesar(cobrar(socio, 10000));
        assertThat(conDni.docTipo()).isEqualTo(96);
        assertThat(conDni.docNro()).isEqualTo(Long.parseLong(socio.getDni()));

        Usuario sinDni = socio();
        sinDni.setDni("PAS-1234");
        usuarioRepository.save(sinDni);
        ComprobanteFiscalDTO anonima = facturarYProcesar(cobrar(sinDni, 10000));
        assertThat(anonima.estado()).isEqualTo("AUTORIZADO");
        assertThat(anonima.docTipo()).isEqualTo(99);
        assertThat(anonima.receptorNombre()).isNull();
    }

    @Test
    void siArcaDesconoceElPermisoDeAccesoSePideOtro() {
        datosFiscales(CondicionIva.MONOTRIBUTO, false);
        facturarYProcesar(cobrar(socio(), 10000));
        assertThat(tickets.count()).isPositive();

        // Como si ARCA no reconociera el permiso guardado. Lo autorizado lo "recuerda" de la base
        simulador.reiniciar();
        PagoListadoDTO otro = cobrar(socio(), 20000);
        ComprobanteFiscalDTO esperando = facturarYProcesar(otro);
        assertThat(esperando.estado()).isEqualTo("PENDIENTE");
        assertThat(esperando.ultimoError()).contains("600");

        facturacion.procesarAhora();
        ComprobanteFiscalDTO factura = facturarYProcesar(otro);
        assertThat(factura.estado()).isEqualTo("AUTORIZADO");
        assertThat(factura.numero()).isEqualTo(2);
    }

    @Test
    void elEstadoYLaPruebaDeConexionConElSimulador() {
        EstadoFacturacionDTO sinDatos = facturacion.estado();
        assertThat(sinDatos.habilitada()).isTrue();
        assertThat(sinDatos.ambiente()).isEqualTo("SIMULADOR");
        assertThat(sinDatos.deVerdad()).isFalse();
        assertThat(sinDatos.certificadoCargado()).isTrue();
        assertThat(sinDatos.certificadoDeMentira()).isTrue();
        assertThat(sinDatos.datosCompletos()).isFalse();
        PruebaConexionDTO fallida = facturacion.probarConexion();
        assertThat(fallida.ok()).isFalse();
        assertThat(fallida.pasos().get(fallida.pasos().size() - 1).nombre()).isEqualTo("Datos fiscales");

        datosFiscales(CondicionIva.MONOTRIBUTO, false);
        PruebaConexionDTO prueba = facturacion.probarConexion();
        assertThat(prueba.ok()).isTrue();
        assertThat(prueba.pasos()).hasSize(5).allMatch(PruebaConexionDTO.Paso::ok);
        assertThat(facturacion.estado().datosCompletos()).isTrue();
    }

    @Test
    void laCuitSeValidaConSuDigitoVerificador() {
        assertThat(DatosFiscalesService.cuitValida("20123456786")).isTrue();
        assertThat(DatosFiscalesService.cuitValida("20111111112")).isTrue();
        assertThat(DatosFiscalesService.cuitValida("20123456789")).isFalse();
        assertThat(DatosFiscalesService.cuitValida("2012345678")).isFalse();
        assertThatThrownBy(() -> datosFiscales.guardar(datos("20-12345678-9", CondicionIva.MONOTRIBUTO, false)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("CUIT");
        // Con guiones y espacios se acepta, y se guarda sin ellos
        assertThat(datosFiscales.guardar(datos("20-12345678-6 ", CondicionIva.MONOTRIBUTO, false)).cuit()).isEqualTo(CUIT);
    }

    @Test
    void recepcionVeLasFacturasPeroSoloElAdminCargaLosDatosYAnula() throws Exception {
        String recepcion = token(usuario(Rol.RECEPCION));
        String admin = token(usuario(Rol.ADMIN));
        String profesor = token(usuario(Rol.PROFESOR));
        String datosJson = "{\"cuit\":\"" + CUIT + "\",\"razonSocial\":\"Gimnasio de Prueba SRL\",\"condicionIva\":\"MONOTRIBUTO\","
                + "\"ingresosBrutos\":\"Exento\",\"inicioActividades\":\"2020-03-01\",\"domicilioComercial\":\"Av. Siempre Viva 123\","
                + "\"puntoVenta\":3,\"identificarSocio\":false}";

        mvc.perform(get("/api/facturacion/estado").header("Authorization", recepcion))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ambiente").value("SIMULADOR"));
        mvc.perform(get("/api/facturacion/comprobantes").header("Authorization", profesor)).andExpect(status().isForbidden());
        mvc.perform(put("/api/facturacion/datos-fiscales").header("Authorization", recepcion)
                .contentType(MediaType.APPLICATION_JSON).content(datosJson)).andExpect(status().isForbidden());
        mvc.perform(post("/api/facturacion/comprobantes/1/anular").header("Authorization", recepcion)
                .contentType(MediaType.APPLICATION_JSON).content("{\"motivo\":\"Prueba\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/facturacion/procesar").header("Authorization", recepcion)).andExpect(status().isNoContent());

        mvc.perform(put("/api/facturacion/datos-fiscales").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(datosJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cuit").value(CUIT));
        mvc.perform(post("/api/facturacion/comprobantes/999999/anular").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"motivo\":\"Prueba\"}")).andExpect(status().isNotFound());
        mvc.perform(get("/api/auth/funciones")).andExpect(jsonPath("$.facturacion").value(true));
    }
}
