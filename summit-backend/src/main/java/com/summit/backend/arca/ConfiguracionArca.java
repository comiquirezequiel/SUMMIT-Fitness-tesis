package com.summit.backend.arca;

import com.summit.backend.model.AmbienteArca;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Configuración de la factura electrónica (summit.arca.*, ver FACTURACION.md). Apagada por defecto: no se factura nada
 * y el panel no muestra la sección.
 */
@Component
public class ConfiguracionArca {

    // Direcciones oficiales: los manuales vigentes siguen usando afip.gov.ar (los dominios de arca no sirven para esto)
    private static final String WSAA_HOMOLOGACION = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";
    private static final String WSFE_HOMOLOGACION = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx";
    private static final String WSAA_PRODUCCION = "https://wsaa.afip.gov.ar/ws/services/LoginCms";
    private static final String WSFE_PRODUCCION = "https://servicios1.afip.gov.ar/wsfev1/service.asmx";
    static final String WSAA_SIMULADOR = "simulador:wsaa";
    static final String WSFE_SIMULADOR = "simulador:wsfe";

    private final boolean habilitada;
    private final AmbienteArca ambiente;
    private final String certificado;
    private final String certificadoPassword;
    private final String wsaaUrl;
    private final String wsfeUrl;

    // Se leen como texto: en application-local.properties pueden quedar vacíos (ARCA_HABILITADA=, ARCA_AMBIENTE=)
    public ConfiguracionArca(@Value("${summit.arca.habilitada:false}") String habilitada,
                             @Value("${summit.arca.ambiente:SIMULADOR}") String ambiente,
                             @Value("${summit.arca.certificado:}") String certificado,
                             @Value("${summit.arca.certificado-password:}") String certificadoPassword,
                             @Value("${summit.arca.wsaa-url:}") String wsaaUrl,
                             @Value("${summit.arca.wsfe-url:}") String wsfeUrl) {
        this.habilitada = "true".equalsIgnoreCase(habilitada.trim());
        this.ambiente = ambiente(ambiente);
        this.certificado = certificado.trim();
        this.certificadoPassword = certificadoPassword;
        this.wsaaUrl = wsaaUrl.isBlank() ? switch (this.ambiente) {
            case SIMULADOR -> WSAA_SIMULADOR;
            case HOMOLOGACION -> WSAA_HOMOLOGACION;
            case PRODUCCION -> WSAA_PRODUCCION;
        } : wsaaUrl.trim();
        this.wsfeUrl = wsfeUrl.isBlank() ? switch (this.ambiente) {
            case SIMULADOR -> WSFE_SIMULADOR;
            case HOMOLOGACION -> WSFE_HOMOLOGACION;
            case PRODUCCION -> WSFE_PRODUCCION;
        } : wsfeUrl.trim();
    }

    // Vacío = simulador. Uno mal escrito frena el arranque: no se puede adivinar si se quería facturar de verdad
    private static AmbienteArca ambiente(String texto) {
        if (texto.isBlank()) {
            return AmbienteArca.SIMULADOR;
        }
        try {
            return AmbienteArca.valueOf(texto.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("summit.arca.ambiente (ARCA_AMBIENTE) tiene que ser SIMULADOR, HOMOLOGACION "
                    + "o PRODUCCION, y dice \"" + texto + "\"");
        }
    }

    public boolean habilitada() {
        return habilitada;
    }

    public AmbienteArca ambiente() {
        return ambiente;
    }

    /** Ruta al archivo .p12 con el certificado y la clave privada (fuera del repositorio). */
    public String certificado() {
        return certificado;
    }

    public String certificadoPassword() {
        return certificadoPassword;
    }

    public String wsaaUrl() {
        return wsaaUrl;
    }

    public String wsfeUrl() {
        return wsfeUrl;
    }
}
