package com.summit.backend.arca;

import org.bouncycastle.cert.jcajce.JcaCertStore;
import org.bouncycastle.cms.CMSProcessableByteArray;
import org.bouncycastle.cms.CMSSignedData;
import org.bouncycastle.cms.CMSSignedDataGenerator;
import org.bouncycastle.cms.jcajce.JcaSignerInfoGeneratorBuilder;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.bouncycastle.operator.jcajce.JcaDigestCalculatorProviderBuilder;

import java.util.Base64;
import java.util.List;

/**
 * Firma del pedido de acceso (TRA) para el WSAA: un CMS "SignedData" con el TRA adentro, la firma (SHA-256 con RSA) y
 * el certificado, en Base64.
 */
final class FirmaCms {

    private FirmaCms() {
    }

    static String firmar(byte[] contenido, CertificadosArca.CertificadoArca certificado) throws ArcaException {
        try {
            ContentSigner firmante = new JcaContentSignerBuilder("SHA256withRSA").build(certificado.clave());
            CMSSignedDataGenerator generador = new CMSSignedDataGenerator();
            generador.addSignerInfoGenerator(new JcaSignerInfoGeneratorBuilder(new JcaDigestCalculatorProviderBuilder().build())
                    .build(firmante, certificado.certificado()));
            generador.addCertificates(new JcaCertStore(List.of(certificado.certificado())));
            CMSSignedData cms = generador.generate(new CMSProcessableByteArray(contenido), true);
            return Base64.getEncoder().encodeToString(cms.getEncoded());
        } catch (Exception e) {
            throw new ArcaException("FIRMA", "No se pudo firmar el pedido de acceso con el certificado: " + e.getMessage(), false, e);
        }
    }
}
